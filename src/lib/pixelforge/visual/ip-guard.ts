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
  { groups: [0xfc00, 0, 0, 0, 0, 0, 0, 0], bits: 7 }, // fc00::/7 ULA
  { groups: [0xfe80, 0, 0, 0, 0, 0, 0, 0], bits: 10 }, // fe80::/10 link-local
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

function isForbiddenIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // IPv4-mapped: ::ffff:a.b.c.d → aplica reglas IPv4 al embebido.
  const mappedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedMatch) {
    return isForbiddenIpv4(mappedMatch[1]!);
  }

  const groups = expandIpv6(lower);
  if (!groups) return true; // no parseable ⇒ fail-closed

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
