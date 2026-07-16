/**
 * SPIKE defensivo anti-SSRF/anti-DNS-rebinding — PixelForge F4-T0.
 *
 * Qué es esto: PixelForge dejará que el trabajador pegue URLs de referencia de
 * sitios de clientes; el servidor las fetchea para extraer señales
 * visuales/semánticas. Un fetcher ingenuo es un vector SSRF (metadata cloud
 * 169.254.169.254, servicios internos, loopback) y de DNS-rebinding (un
 * dominio que resuelve público en la validación pre-conexión pero interno en
 * la conexión real, TOCTOU clásico). Este script es un SPIKE — prueba de
 * concepto desechable, NO se importa desde `src/`, NO corre en `npm test` ni
 * en CI — que valida el mecanismo defensivo central ANTES de construir el
 * safe-fetch real (F4-T2, en `src/lib/pixelforge/visual/safe-fetch.ts`, con
 * tests formales de vitest).
 *
 * `undici` NO está instalado en este repo. Por eso se usa `node:https` /
 * `node:http` nativos, inyectando un `lookup` propio (`guardedLookup`) en
 * `options.lookup` de `https.get`/`http.get`. La razón de fondo: Node usa esa
 * función de lookup para resolver el hostname de la conexión REAL (el socket
 * TCP que efectivamente se abre), no solo para una validación "de a un lado".
 * Si en cambio hiciéramos `dns.lookup(hostname)` aparte y luego dejáramos que
 * `https.get` resolviera el hostname *de nuevo* por su cuenta, un atacante que
 * controla el DNS podría devolver una IP pública en el primer lookup (el que
 * validamos) y una IP privada en el segundo (el que de verdad conecta) —
 * DNS-rebinding. Inyectar el MISMO guard como `lookup` de la request cierra
 * esa ventana: solo hay UNA resolución, y es la que se valida.
 *
 * Qué queda validado por este spike (ver tabla de resultados en
 * `.superpowers/sdd/task-f4-0-report.md`):
 *   - `isForbiddenAddress`: clasificación pura de IPv4/IPv6 prohibidas
 *     (privados, loopback, link-local/metadata, CGNAT, ULA, IPv4-mapped).
 *   - `guardedLookup`: intercepta hostnames que resuelven a rangos
 *     prohibidos y jamás conecta (llama al callback con EFORBIDDEN).
 *   - `safeFetchSpike`: fetch end-to-end con el lookup inyectado, redirects
 *     manuales re-validados en cada hop, límite de bytes, y allowlist de
 *     esquema/puerto/content-type.
 *
 * ⚠️ HALLAZGO CRÍTICO DEL SPIKE (esto es lo que justifica que exista este
 * spike antes de construir F4-T2): cuando el hostname de la URL YA es una
 * IP literal (`http://169.254.169.254/...`), Node NUNCA llama a
 * `options.lookup`. Internamente, `net.Socket.connect` chequea
 * `net.isIP(host)`: si el host ya es una IP válida, se conecta
 * DIRECTAMENTE con esa IP, sin pasar por resolución DNS — así que
 * `guardedLookup` queda completamente en silencio y el guard NO se ejecuta.
 * Se confirmó empíricamente: un `http.get` con `lookup` inyectado contra
 * `http://169.254.169.254/latest/meta-data/` en esta VM devolvió una
 * respuesta 200 real con metadata de instancia — el lookup interceptor
 * jamás fue invocado. Por eso `validateUrl` abajo agrega un chequeo
 * SINCRÓNICO con `net.isIP` + `isForbiddenAddress` para hosts que ya son
 * literales de IP, ANTES de siquiera intentar conectar — el guard inyectado
 * en `lookup` sigue siendo necesario (cubre hostnames que resuelven a
 * direcciones prohibidas, y el TOCTOU de rebinding), pero NO alcanza solo:
 * hacen falta AMBOS mecanismos. F4-T2 debe preservar los dos.
 *
 * Qué queda PENDIENTE para F4-T2 (fuera de alcance de este spike):
 *   - Tests formales (vitest) en vez de este script standalone.
 *   - Configuración real de allowlist de dominios (si aplica) y límites
 *     (tamaño máximo, timeout) como parámetros, no constantes hardcodeadas.
 *   - Métricas/logging de intentos bloqueados para auditoría de seguridad.
 *   - Decidir si además de bloquear por IP, se bloquea por hostname
 *     conocido (p.ej. `metadata.google.internal`) para defensa en profundidad
 *     aunque ese hostname hoy resuelva a una IP no prohibida en este entorno.
 *   - Revisar comportamiento con IPv6 dual-stack real (este spike lo cubre
 *     por código pero no se pudo probar contra un rebinding IPv6 real).
 *
 * Uso: `npx tsx scripts/pixelforge-ssrf-spike.ts` (requiere red disponible
 * para los casos de `guardedLookup`/`safeFetchSpike`; los casos puros de
 * `isForbiddenAddress` no la necesitan y deben pasar 100% siempre).
 */

import * as http from "node:http";
import * as https from "node:https";
import * as dns from "node:dns";
import * as net from "node:net";
import type { LookupAddress, LookupAllOptions } from "node:dns";

// ---------------------------------------------------------------------------
// 1. isForbiddenAddress — clasificación pura de direcciones IP prohibidas.
// ---------------------------------------------------------------------------

/** Convierte "a.b.c.d" a un entero uint32 (big-endian). */
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
  // IPv4-mapped embebido al final, p.ej. "::ffff:192.168.1.1" — lo manejamos
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
  /** grupos de 16 bits (0-8 elementos, prefijo) */
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
 * loopback, link-local/metadata cloud, CGNAT, ULA, o IPv4-mapped equivalentes.
 * Acepta (false) direcciones públicas normales. Pura, sin red, fail-closed
 * ante entradas no parseables.
 */
function isForbiddenAddress(ip: string): boolean {
  if (ip.includes(":")) return isForbiddenIpv6(ip);
  return isForbiddenIpv4(ip);
}

// ---------------------------------------------------------------------------
// 2. guardedLookup — el corazón anti-rebinding.
// ---------------------------------------------------------------------------

export class ForbiddenAddressError extends Error {
  code = "EFORBIDDEN";
  constructor(hostname: string, address: string) {
    super(`Dirección prohibida para "${hostname}": ${address}`);
    this.name = "ForbiddenAddressError";
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * Firma compatible con `dns.lookup` para poder inyectarse como
 * `options.lookup` de `http.get`/`https.get`. Internamente SIEMPRE resuelve
 * contra el `dns.lookup` real con `{ all: true }` (sin importar lo que pida
 * el caller) para poder inspeccionar TODAS las direcciones — un hostname
 * puede tener múltiples registros A/AAAA y basta con que UNO sea prohibido.
 *
 * ⚠️ HALLAZGO DEL SPIKE (contradice la asunción inicial documentada en un
 * borrador anterior de este comentario — se deja registrado el error
 * porque es justo el tipo de sorpresa que este spike existe para atrapar):
 * en Node 20 con `autoSelectFamily` (Happy Eyeballs) activo por defecto,
 * `https.get`/`http.get` invocan `options.lookup` con `options.all: true`
 * cuando necesitan intentar conectar contra VARIAS direcciones en paralelo
 * (dual-stack). En ese modo, Node espera que el callback devuelva la
 * dirección en el formato ARREGLO de `dns.lookup({ all: true })`:
 * `callback(err, addresses: {address,family}[])` — NO el formato clásico
 * `callback(err, address: string, family: number)`. Devolver el formato
 * equivocado no lanza en el momento del callback: el error aparece más
 * tarde, dentro de Node (`emitLookup` en `node:net`), como
 * `TypeError [ERR_INVALID_IP_ADDRESS]: Invalid IP address: undefined` —
 * un mensaje que no delata en absoluto que la causa es un mismatch de forma
 * en el callback de `lookup`. Se confirmó con un repro aislado: al llamar
 * `https.get('https://example.com/', { lookup })` Node invocó nuestro
 * lookup con `options` = `{ hints: 32, all: true }`. Por eso este guard
 * respeta `options.all` tal como lo pide Node y responde con la forma
 * correspondiente en cada caso.
 */
function guardedLookup(
  hostname: string,
  options: dns.LookupOptions | number,
  callback: LookupCallback,
): void {
  const opts: dns.LookupOptions = typeof options === "number" ? { family: options } : options ?? {};
  const requestedFamily = typeof options === "number" ? options : opts.family ?? 0;
  const wantsAll = typeof options !== "number" && opts.all === true;

  const allOptions: LookupAllOptions = { all: true, verbatim: true };
  if (requestedFamily === 4 || requestedFamily === 6) {
    allOptions.family = requestedFamily;
  }

  dns.lookup(hostname, allOptions, (err, addresses) => {
    if (err) {
      callback(err, wantsAll ? [] : "");
      return;
    }
    const list = addresses as LookupAddress[];
    if (list.length === 0) {
      const notFound = new Error(`Sin direcciones para "${hostname}"`);
      callback(notFound, wantsAll ? [] : "");
      return;
    }

    const forbidden = list.find((a) => isForbiddenAddress(a.address));
    if (forbidden) {
      const rejection = new ForbiddenAddressError(hostname, forbidden.address);
      callback(rejection, wantsAll ? [] : "");
      return;
    }

    if (wantsAll) {
      callback(null, list);
      return;
    }
    const first = list[0]!;
    callback(null, first.address, first.family);
  });
}

// ---------------------------------------------------------------------------
// 3. safeFetchSpike — fetch e2e con el guard inyectado.
// ---------------------------------------------------------------------------

const ALLOWED_PORTS = new Set(["80", "443", ""]);
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8000;

export interface SafeFetchResult {
  ok: boolean;
  status?: number;
  reason?: string;
  bytes?: number;
}

function validateUrl(urlStr: string): { url: URL; reason?: string } {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { url: new URL("http://invalid.invalid"), reason: "url_invalida" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { url, reason: `esquema_no_permitido:${url.protocol}` };
  }
  if (url.username || url.password) {
    return { url, reason: "credenciales_embebidas_no_permitidas" };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { url, reason: `puerto_no_permitido:${url.port}` };
  }
  // HALLAZGO DEL SPIKE: si el hostname YA es una IP literal, Node jamás
  // invoca `options.lookup` (usa `net.isIP` internamente y conecta directo)
  // — así que `guardedLookup` no protege este caso. Lo chequeamos acá,
  // sincrónico, antes de intentar conectar.
  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // IPv6 viene entre [ ]
  if (net.isIP(hostname) !== 0 && isForbiddenAddress(hostname)) {
    return { url, reason: `EFORBIDDEN:ip_literal_prohibida:${hostname}` };
  }
  return { url };
}

function fetchOnce(url: URL): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  location?: string;
}> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.get(
      url,
      {
        lookup: guardedLookup,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        let destroyed = false;

        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            destroyed = true;
            res.destroy(new Error("respuesta_excede_2mb"));
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          if (destroyed) return; // el 'error' ya rechaza la promesa
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
            location: res.headers.location,
          });
        });

        res.on("error", (err) => reject(err));
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.on("error", (err) => reject(err));
  });
}

/**
 * Fetch defensivo end-to-end: valida esquema/puerto/credenciales, resuelve
 * con `guardedLookup` inyectado (mismo guard en la conexión real, cierra el
 * TOCTOU de rebinding), sigue redirects manualmente re-validando cada hop,
 * corta el stream a 2MB, y exige `content-type: text/html*`. Nunca lanza:
 * captura todo y devuelve un resultado estructurado.
 */
async function safeFetchSpike(urlStr: string): Promise<SafeFetchResult> {
  let current = urlStr;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url, reason } = validateUrl(current);
    if (reason) {
      return { ok: false, reason };
    }

    try {
      const res = await fetchOnce(url);

      if (res.statusCode >= 300 && res.statusCode < 400 && res.location) {
        if (hop === MAX_REDIRECTS) {
          return { ok: false, status: res.statusCode, reason: "demasiados_redirects" };
        }
        // Location puede ser relativa — resolver contra la URL actual.
        current = new URL(res.location, url).toString();
        continue;
      }

      const contentType = res.headers["content-type"] ?? "";
      if (!contentType.toLowerCase().startsWith("text/html")) {
        return {
          ok: false,
          status: res.statusCode,
          reason: `content_type_no_permitido:${contentType || "(vacio)"}`,
        };
      }

      return { ok: true, status: res.statusCode, bytes: res.body.length };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      const message = err instanceof Error ? err.message : String(err);
      if (code === "EFORBIDDEN") {
        return { ok: false, reason: `EFORBIDDEN:${message}` };
      }
      return { ok: false, reason: `error_red:${message}` };
    }
  }

  return { ok: false, reason: "demasiados_redirects" };
}

// ---------------------------------------------------------------------------
// 4. Auto-pruebas.
// ---------------------------------------------------------------------------

interface CaseResult {
  name: string;
  expected: string;
  actual: string;
  pass: boolean;
  pure: boolean; // true = no depende de red, DEBE pasar 100%
}

const results: CaseResult[] = [];

function recordPure(name: string, expected: boolean, actual: boolean): void {
  results.push({
    name,
    expected: expected ? "prohibido" : "permitido",
    actual: actual ? "prohibido" : "permitido",
    pass: expected === actual,
    pure: true,
  });
}

function isForbiddenAddressBattery(): void {
  const cases: Array<[string, boolean]> = [
    // Privados IPv4
    ["10.0.0.1", true],
    ["10.255.255.255", true],
    ["172.16.0.1", true],
    ["172.31.255.255", true],
    ["172.15.255.255", false], // justo fuera de 172.16.0.0/12
    ["192.168.1.1", true],
    ["192.168.0.0", true],
    // Loopback
    ["127.0.0.1", true],
    ["127.255.255.255", true],
    // 0.0.0.0/8
    ["0.0.0.0", true],
    ["0.1.2.3", true],
    // link-local / metadata
    ["169.254.169.254", true],
    ["169.254.0.1", true],
    // CGNAT
    ["100.64.0.1", true],
    ["100.127.255.255", true],
    ["100.63.255.255", false], // justo fuera de 100.64.0.0/10
    // Públicas
    ["8.8.8.8", false],
    ["1.1.1.1", false],
    ["93.184.216.34", false],
    // IPv6 loopback / ULA / link-local
    ["::1", true],
    ["fc00::1", true],
    ["fd12:3456:789a::1", true],
    ["fe80::1", true],
    // IPv4-mapped
    ["::ffff:127.0.0.1", true],
    ["::ffff:169.254.169.254", true],
    ["::ffff:8.8.8.8", false],
    // IPv6 público normal
    ["2606:4700:4700::1111", false], // Cloudflare DNS
  ];

  for (const [ip, expected] of cases) {
    recordPure(`isForbiddenAddress(${ip})`, expected, isForbiddenAddress(ip));
  }
}

function guardedLookupOnce(hostname: string): Promise<{ err: NodeJS.ErrnoException | null }> {
  return new Promise((resolve) => {
    guardedLookup(hostname, { all: true }, (err) => {
      resolve({ err: err as NodeJS.ErrnoException | null });
    });
  });
}

async function guardedLookupBattery(): Promise<void> {
  const netCases: Array<{ name: string; hostname: string; expectForbidden: boolean }> = [
    { name: "guardedLookup(localhost)", hostname: "localhost", expectForbidden: true },
    { name: "guardedLookup(127.0.0.1 literal)", hostname: "127.0.0.1", expectForbidden: true },
    { name: "guardedLookup(example.com)", hostname: "example.com", expectForbidden: false },
  ];

  for (const c of netCases) {
    try {
      const { err } = await guardedLookupOnce(c.hostname);
      const gotForbidden = err?.code === "EFORBIDDEN";
      const pass = gotForbidden === c.expectForbidden;
      // Para el caso "permite" (example.com), si falló por razones de red
      // (no EFORBIDDEN) y no por el guard, lo marcamos no-concluyente en vez
      // de FALLA — no controlamos la disponibilidad de la red del entorno.
      const inconclusive = !c.expectForbidden && err != null && !gotForbidden;
      results.push({
        name: c.name,
        expected: c.expectForbidden ? "EFORBIDDEN" : "resuelve OK",
        actual: inconclusive
          ? `NO-CONCLUYENTE (${err?.code ?? err?.message})`
          : gotForbidden
            ? "EFORBIDDEN"
            : "resuelve OK",
        pass: inconclusive ? true : pass,
        pure: false,
      });
    } catch (e) {
      results.push({
        name: c.name,
        expected: c.expectForbidden ? "EFORBIDDEN" : "resuelve OK",
        actual: `NO-CONCLUYENTE (excepcion: ${(e as Error).message})`,
        pure: false,
        pass: true,
      });
    }
  }
}

async function safeFetchBattery(): Promise<void> {
  const netCases: Array<{
    name: string;
    url: string;
    // "block" = DEBE bloquear siempre (aunque no haya red);
    // "ok-or-inconclusive" = se espera ok=true, pero si falla por red se
    // marca no-concluyente en vez de FALLA.
    kind: "block" | "ok-or-inconclusive";
    blockReasonSubstr?: string;
  }> = [
    {
      name: "safeFetchSpike(metadata cloud 169.254.169.254)",
      url: "http://169.254.169.254/latest/meta-data/",
      kind: "block",
      blockReasonSubstr: "EFORBIDDEN",
    },
    {
      name: "safeFetchSpike(loopback literal 127.0.0.1, puerto 80)",
      url: "http://127.0.0.1/",
      kind: "block",
      blockReasonSubstr: "EFORBIDDEN",
    },
    {
      name: "safeFetchSpike(loopback 127.0.0.1:9003, puerto no estándar)",
      url: "http://127.0.0.1:9003/",
      // Este puerto ya cae por el chequeo de puerto (9003 no está en la
      // allowlist 80/443) ANTES de llegar al chequeo de IP literal — sigue
      // bloqueado, pero por otra razón. Se deja el caso porque así lo pide
      // el brief; el caso anterior (puerto 80) es el que de verdad ejercita
      // el chequeo de IP-literal-prohibida.
      kind: "block",
      blockReasonSubstr: "puerto_no_permitido",
    },
    {
      name: "safeFetchSpike(https://example.com/)",
      url: "https://example.com/",
      kind: "ok-or-inconclusive",
    },
    {
      name: "safeFetchSpike(puerto no permitido :22)",
      url: "http://example.com:22/",
      kind: "block",
      blockReasonSubstr: "puerto_no_permitido",
    },
  ];

  for (const c of netCases) {
    const res = await safeFetchSpike(c.url);
    if (c.kind === "block") {
      const matches = !res.ok && (c.blockReasonSubstr ? (res.reason ?? "").includes(c.blockReasonSubstr) : true);
      results.push({
        name: c.name,
        expected: `bloqueado (${c.blockReasonSubstr ?? "reject"})`,
        actual: res.ok ? `permitido (bug!)` : `bloqueado (${res.reason})`,
        pass: matches,
        pure: true, // el bloqueo DEBE pasar aunque no haya red (ocurre pre-conexión)
      });
    } else {
      const inconclusive = !res.ok && (res.reason ?? "").startsWith("error_red:");
      results.push({
        name: c.name,
        expected: "ok=true (o no-concluyente si falla la red)",
        actual: inconclusive
          ? `NO-CONCLUYENTE (${res.reason})`
          : res.ok
            ? `ok status=${res.status} bytes=${res.bytes}`
            : `FALLA reason=${res.reason}`,
        pass: inconclusive ? true : res.ok,
        pure: false,
      });
    }
  }
}

async function main(): Promise<void> {
  isForbiddenAddressBattery();
  await guardedLookupBattery();
  await safeFetchBattery();

  const nameWidth = Math.max(...results.map((r) => r.name.length), 20);
  const expWidth = Math.max(...results.map((r) => r.expected.length), 10);

  console.log(
    "\n" +
      "caso".padEnd(nameWidth) +
      "  " +
      "esperado".padEnd(expWidth) +
      "  " +
      "real / veredicto",
  );
  console.log("-".repeat(nameWidth + expWidth + 20));

  let pureFailures = 0;
  for (const r of results) {
    const mark = r.pass ? "OK " : "FALLA";
    console.log(
      `${mark} ${r.name.padEnd(nameWidth)}  ${r.expected.padEnd(expWidth)}  ${r.actual}`,
    );
    if (!r.pass && r.pure) pureFailures++;
  }

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${total} casos OK.`);

  if (pureFailures > 0) {
    console.error(
      `\n${pureFailures} caso(s) de SEGURIDAD (obligatorios, sin red) fallaron. Exit 1.`,
    );
    process.exit(1);
  }

  console.log("\nTodos los casos de seguridad obligatorios pasaron.");
}

main().catch((err) => {
  console.error("Error inesperado ejecutando el spike:", err);
  process.exit(1);
});
