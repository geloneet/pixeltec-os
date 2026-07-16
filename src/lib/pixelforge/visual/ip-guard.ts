/**
 * Clasificación pura de direcciones IP prohibidas (anti-SSRF).
 *
 * Portado desde el spike validado `scripts/pixelforge-ssrf-spike.ts`
 * (F4-T0, ver `.superpowers/sdd/task-f4-0-report.md`: 27/27 casos puros OK).
 * Sin dependencias de red — solo aritmética de enteros sobre las direcciones.
 *
 * Se usa en dos puntos de `safe-fetch.ts`:
 *   1. Pre-check SÍNCRONO cuando el host de la URL YA es un literal de IP
 *      (`net.isIP(host) !== 0`) — Node conecta directo en ese caso sin pasar
 *      por `dns.lookup`/`options.lookup`, así que este chequeo es el ÚNICO
 *      guard posible para ese vector.
 *   2. Dentro de `guardedLookup`, sobre TODAS las direcciones que devuelve
 *      `dns.lookup(hostname, { all: true })` — cierra el TOCTOU de
 *      DNS-rebinding para hostnames.
 */

/** Convierte "a.b.c.d" a un entero uint32 (big-endian). null si no parsea. */
function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    out = (out << 8) | n;
  }
  // `<<` en JS trabaja en int32 con signo; normalizamos a unsigned.
  return out >>> 0;
}

interface Ipv4Range {
  base: string;
  bits: number;
}

const FORBIDDEN_IPV4_RANGES: Ipv4Range[] = [
  { base: "10.0.0.0", bits: 8 }, // privado
  { base: "172.16.0.0", bits: 12 }, // privado
  { base: "192.168.0.0", bits: 16 }, // privado
  { base: "127.0.0.0", bits: 8 }, // loopback
  { base: "0.0.0.0", bits: 8 }, // "esta red"
  { base: "169.254.0.0", bits: 16 }, // link-local / metadata cloud
  { base: "100.64.0.0", bits: 10 }, // CGNAT
];

function ipv4InRange(ip: number, range: Ipv4Range): boolean {
  const base = ipv4ToUint32(range.base);
  if (base === null) return false;
  if (range.bits === 0) return true;
  const mask = range.bits === 32 ? 0xffffffff : (0xffffffff << (32 - range.bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

function isForbiddenIpv4(ip: string): boolean {
  const asInt = ipv4ToUint32(ip);
  if (asInt === null) return true; // no parseable ⇒ tratamos como prohibido (fail-closed)
  return FORBIDDEN_IPV4_RANGES.some((range) => ipv4InRange(asInt, range));
}

/** Expande una dirección IPv6 (con posible "::") a 8 grupos de 16 bits. */
function expandIpv6(ip: string): number[] | null {
  // IPv4-mapped embebido al final, p.ej. "::ffff:192.168.1.1" — se maneja
  // aparte antes de llamar a esta función (ver isForbiddenIpv6).
  const parts = ip.split("::");
  if (parts.length > 2) return null;

  const parseGroups = (s: string): number[] | null => {
    if (s === "") return [];
    const groups = s.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  if (parts.length === 1) {
    const groups = parseGroups(parts[0]!);
    if (!groups || groups.length !== 8) return null;
    return groups;
  }

  const head = parseGroups(parts[0]!);
  const tail = parseGroups(parts[1]!);
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill(0), ...tail];
}

interface Ipv6Range {
  /** grupos de 16 bits (prefijo) */
  groups: number[];
  bits: number;
}

const FORBIDDEN_IPV6_RANGES: Ipv6Range[] = [
  { groups: [0, 0, 0, 0, 0, 0, 0, 1], bits: 128 }, // ::1 loopback
  { groups: [0, 0, 0, 0, 0, 0, 0, 0], bits: 128 }, // :: unspecified (a menudo rutea a loopback)
  { groups: [0xfc00, 0, 0, 0, 0, 0, 0, 0], bits: 7 }, // fc00::/7 ULA
  { groups: [0xfe80, 0, 0, 0, 0, 0, 0, 0], bits: 10 }, // fe80::/10 link-local
];

/**
 * Prefijos /96 cuyos últimos 32 bits (groups[6]/groups[7]) embeben una
 * dirección IPv4 completa. Para CUALQUIER dirección que caiga en uno de
 * estos prefijos, la IPv4 embebida se extrae NUMÉRICAMENTE (no por regex de
 * texto) y se re-evalúa con las reglas IPv4 — así cubre por igual la forma
 * hex-comprimida (`::ffff:a9fe:a9fe`), la dotted (`::ffff:169.254.169.254`,
 * manejada aparte en `isForbiddenIpv6` porque `expandIpv6` no parsea
 * octetos decimales) y cualquier otra normalización que produzca el mismo
 * valor numérico (p.ej. la que hace el parser de `URL` de WHATWG, que
 * normaliza IPv4-mapped a la forma hex).
 */
const IPV4_EMBEDDED_IPV6_PREFIXES: Ipv6Range[] = [
  { groups: [0, 0, 0, 0, 0, 0xffff, 0, 0], bits: 96 }, // ::ffff:0:0/96 IPv4-mapped
  { groups: [0, 0, 0, 0, 0, 0, 0, 0], bits: 96 }, // ::/96 IPv4-compatible (deprecado)
  { groups: [0x64, 0xff9b, 0, 0, 0, 0, 0, 0], bits: 96 }, // 64:ff9b::/96 NAT64
];

function ipv6InRange(groups: number[], range: Ipv6Range): boolean {
  let bitsLeft = range.bits;
  for (let i = 0; i < 8 && bitsLeft > 0; i++) {
    const bitsHere = Math.min(16, bitsLeft);
    const mask = bitsHere === 16 ? 0xffff : (0xffff << (16 - bitsHere)) & 0xffff;
    if ((groups[i]! & mask) !== (range.groups[i]! & mask)) return false;
    bitsLeft -= bitsHere;
  }
  return true;
}

/** Extrae los últimos 32 bits (groups[6]/groups[7]) como uint32 IPv4. */
function extractEmbeddedIpv4(groups: number[]): number {
  return ((groups[6]! << 16) | groups[7]!) >>> 0;
}

function isForbiddenIpv4Number(ip: number): boolean {
  return FORBIDDEN_IPV4_RANGES.some((range) => ipv4InRange(ip, range));
}

function isForbiddenIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  const groups = expandIpv6(lower);
  if (!groups) {
    // `expandIpv6` no parsea octetos decimales dentro de un grupo — cubre
    // acá el caso legado de IPv4-mapped escrito en forma dotted al final,
    // p.ej. "::ffff:169.254.169.254" (la forma hex-comprimida equivalente,
    // "::ffff:a9fe:a9fe", SÍ la parsea `expandIpv6` y se resuelve más abajo
    // vía `IPV4_EMBEDDED_IPV6_PREFIXES` — numéricamente, no por regex).
    const mappedDotted = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mappedDotted) return isForbiddenIpv4(mappedDotted[1]!);
    return true; // no parseable ⇒ fail-closed
  }

  const embedded = IPV4_EMBEDDED_IPV6_PREFIXES.find((range) => ipv6InRange(groups, range));
  if (embedded) {
    return isForbiddenIpv4Number(extractEmbeddedIpv4(groups));
  }

  return FORBIDDEN_IPV6_RANGES.some((range) => ipv6InRange(groups, range));
}

/**
 * Rechaza (true = prohibido) direcciones IPv4/IPv6 en rangos privados,
 * loopback, link-local/metadata cloud, CGNAT, ULA, o IPv4-mapped
 * equivalentes. Acepta (false) direcciones públicas normales.
 *
 * Pura, sin red. Fail-closed: cualquier entrada no parseable como IPv4 ni
 * IPv6 se trata como prohibida.
 */
export function isForbiddenAddress(ip: string): boolean {
  if (ip.includes(":")) return isForbiddenIpv6(ip);
  return isForbiddenIpv4(ip);
}
