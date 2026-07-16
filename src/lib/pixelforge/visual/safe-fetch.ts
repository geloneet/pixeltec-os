/**
 * safeFetch — fetcher defensivo anti-SSRF / anti-DNS-rebinding para URLs de
 * referencia que pega el trabajador en PixelForge (F4 Visual).
 *
 * Portado desde el spike validado `scripts/pixelforge-ssrf-spike.ts` (F4-T0,
 * ver `.superpowers/sdd/task-f4-0-report.md`). Preserva los DOS hallazgos
 * críticos del spike, ambos obligatorios y complementarios:
 *
 * 1. IP LITERAL BYPASEA `options.lookup`: cuando el host de la URL YA es una
 *    dirección IP (`http://169.254.169.254/...`), `net.Socket.connect`
 *    detecta `net.isIP(host) !== 0` y conecta DIRECTO, sin invocar el
 *    `lookup` inyectado. Este VM tiene un endpoint de metadata cloud real y
 *    alcanzable en 169.254.169.254 — se confirmó empíricamente en el spike
 *    que un lookup inyectado por sí solo NO lo bloquea. Por eso
 *    `validateUrl` corre un chequeo SÍNCRONO con `net.isIP` +
 *    `isForbiddenAddress` ANTES de intentar conectar, en cada hop
 *    (incluyendo los de redirects).
 * 2. `autoSelectFamily` (Happy Eyeballs, default-on en Node 20) invoca el
 *    `lookup` inyectado con `options.all: true` y espera el callback en
 *    formato ARRAY (`(err, addresses: {address,family}[])`), no en el
 *    formato clásico `(err, address, family)`. `guardedLookup` debe
 *    respetar `options.all` tal como lo pide Node o revienta más adelante
 *    con un error engañoso (`ERR_INVALID_IP_ADDRESS`) en cualquier request
 *    normal (dual-stack es el comportamiento por defecto, no un caso raro).
 *
 * Nota de convención: este repo no tiene instalado el paquete `server-only`,
 * así que no se importa aquí — este módulo de todas formas SOLO debe
 * ejecutarse en servidor (usa `node:http`/`node:https`/`node:net`/`node:dns`
 * nativos, no disponibles en el navegador).
 */

import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import * as dns from "node:dns";
import type { LookupAddress, LookupAllOptions } from "node:dns";
import { isForbiddenAddress } from "./ip-guard";

export type SafeFetchFailure =
  | "invalid-url"
  | "forbidden-scheme"
  | "forbidden-port"
  | "credentials-in-url"
  | "forbidden-address"
  | "too-many-redirects"
  | "not-html"
  | "too-large"
  | "timeout"
  | "network-error";

export type SafeFetchResult =
  | { ok: true; status: number; contentType: string; body: string; finalUrl: string }
  | { ok: false; reason: SafeFetchFailure };

const ALLOWED_PORTS = new Set(["80", "443", ""]);
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8000;

const defaultIsPortAllowed = (port: string): boolean => ALLOWED_PORTS.has(port);

/**
 * Predicados inyectables para tests. `isForbidden` es el guard anti-SSRF
 * (obligatorio: `safeFetch`, exportado más abajo, siempre lo pasa como
 * `isForbiddenAddress` real). `isPortAllowed` es opcional y por defecto
 * replica la política real (solo 80/443) — SOLO se sobreescribe en tests
 * que necesitan levantar el servidor http efímero local en un puerto no
 * privilegiado (80/443 requieren root, inviable en un entorno de test/CI
 * sin privilegios). `safeFetch` NUNCA sobreescribe `isPortAllowed`.
 */
export interface SafeFetchDeps {
  isForbidden: (ip: string) => boolean;
  isPortAllowed?: (port: string) => boolean;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * Error interno que carga el `reason` de `SafeFetchResult` ya clasificado,
 * para abortos controlados (too-large / not-html / timeout) que no pasan
 * por `err.code` de Node.
 */
class SafeFetchInternalError extends Error {
  constructor(
    public readonly safeReason: "too-large" | "not-html" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "SafeFetchInternalError";
  }
}

class ForbiddenAddressError extends Error {
  code = "EFORBIDDEN";
  constructor(hostname: string, address: string) {
    super(`Dirección prohibida para "${hostname}": ${address}`);
    this.name = "ForbiddenAddressError";
  }
}

/**
 * Fábrica de `dns.lookup` compatible con `options.lookup` de
 * `http.get`/`https.get`, parametrizada por el predicado de bloqueo. SIEMPRE
 * resuelve internamente contra el `dns.lookup` real con `{ all: true }`
 * (sin importar lo que pida el caller) para poder inspeccionar TODAS las
 * direcciones de un hostname (puede tener varios registros A/AAAA; basta
 * con que UNA sea prohibida). Respeta `options.all` del caller al responder
 * (hallazgo #2 del spike: Happy Eyeballs pide `all: true` y espera un
 * array).
 */
function makeGuardedLookup(isForbidden: (ip: string) => boolean): net.LookupFunction {
  return function guardedLookup(
    hostname: string,
    options: dns.LookupOptions | number,
    callback: LookupCallback,
  ): void {
    const opts: dns.LookupOptions = typeof options === "number" ? { family: options } : (options ?? {});
    const requestedFamily = typeof options === "number" ? options : (opts.family ?? 0);
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
        callback(new Error(`Sin direcciones para "${hostname}"`), wantsAll ? [] : "");
        return;
      }

      const forbidden = list.find((a) => isForbidden(a.address));
      if (forbidden) {
        callback(new ForbiddenAddressError(hostname, forbidden.address), wantsAll ? [] : "");
        return;
      }

      if (wantsAll) {
        callback(null, list);
        return;
      }
      const first = list[0]!;
      callback(null, first.address, first.family);
    });
  };
}

type ValidationResult = { ok: true; url: URL } | { ok: false; reason: SafeFetchFailure };

/**
 * Valida esquema/puerto/credenciales de la URL y — hallazgo #1 del spike —
 * si el hostname YA es un literal de IP, corre el chequeo de dirección
 * prohibida de forma SÍNCRONA, ANTES de siquiera intentar conectar (porque
 * `guardedLookup` nunca se invocará para ese caso: `net.Socket.connect`
 * detecta la IP literal y conecta directo). Se llama en cada hop de
 * redirect, no solo en la URL inicial.
 */
function validateUrl(
  urlStr: string,
  isForbidden: (ip: string) => boolean,
  isPortAllowed: (port: string) => boolean,
): ValidationResult {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "forbidden-scheme" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials-in-url" };
  }
  if (!isPortAllowed(url.port)) {
    return { ok: false, reason: "forbidden-port" };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ""); // IPv6 viene entre [ ]
  if (net.isIP(hostname) !== 0 && isForbidden(hostname)) {
    return { ok: false, reason: "forbidden-address" };
  }

  return { ok: true, url };
}

type HopResult =
  | { kind: "redirect"; location: string }
  | { kind: "success"; status: number; contentType: string; body: Buffer };

function fetchHop(url: URL, lookup: net.LookupFunction): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settleResolve = (v: HopResult) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const settleReject = (e: Error) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    };

    const transport = url.protocol === "https:" ? https : http;
    const req = transport.get(url, { lookup, timeout: REQUEST_TIMEOUT_MS }, (res) => {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;

      if (status >= 300 && status < 400 && location) {
        res.destroy();
        settleResolve({ kind: "redirect", location });
        return;
      }

      const contentType = (res.headers["content-type"] ?? "").toString();
      if (!contentType.toLowerCase().startsWith("text/html")) {
        res.destroy();
        settleReject(
          new SafeFetchInternalError("not-html", `content-type no permitido: ${contentType || "(vacío)"}`),
        );
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          res.destroy();
          settleReject(new SafeFetchInternalError("too-large", "respuesta excede el límite de 2MB"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        settleResolve({ kind: "success", status, contentType, body: Buffer.concat(chunks) });
      });
      res.on("error", (err) => settleReject(err));
    });

    req.on("timeout", () => {
      settleReject(new SafeFetchInternalError("timeout", "tiempo de espera agotado"));
      req.destroy();
    });
    req.on("error", (err) => settleReject(err));
  });
}

/**
 * Construye una función `safeFetch` parametrizada por los predicados de
 * `SafeFetchDeps`. `safeFetch` (exportado más abajo) es
 * `createSafeFetch({ isForbidden: isForbiddenAddress })` — el guard real,
 * con `isPortAllowed` en su valor por defecto (80/443 reales). Los tests de
 * happy-path/redirect/2MB/not-html/timeout usan
 * `createSafeFetch({ isForbidden: () => false, isPortAllowed: () => true })`
 * contra un servidor http local efímero (puerto no privilegiado, asignado
 * por el SO); los tests de SEGURIDAD (loopback/metadata/redirect a
 * dirección privada) usan `safeFetch` con el guard real y la política real
 * de puertos.
 */
export function createSafeFetch(deps: SafeFetchDeps) {
  const lookup = makeGuardedLookup(deps.isForbidden);
  const isPortAllowed = deps.isPortAllowed ?? defaultIsPortAllowed;

  return async function safeFetchImpl(urlStr: string): Promise<SafeFetchResult> {
    let current = urlStr;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const validation = validateUrl(current, deps.isForbidden, isPortAllowed);
      if (!validation.ok) {
        return { ok: false, reason: validation.reason };
      }
      const { url } = validation;

      try {
        const res = await fetchHop(url, lookup);

        if (res.kind === "redirect") {
          if (hop === MAX_REDIRECTS) {
            return { ok: false, reason: "too-many-redirects" };
          }
          // Location puede ser relativa — resolver contra la URL actual.
          current = new URL(res.location, url).toString();
          continue;
        }

        return {
          ok: true,
          status: res.status,
          contentType: res.contentType,
          body: res.body.toString("utf-8"),
          finalUrl: url.toString(),
        };
      } catch (err) {
        if (err instanceof SafeFetchInternalError) {
          return { ok: false, reason: err.safeReason };
        }
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === "EFORBIDDEN") {
          return { ok: false, reason: "forbidden-address" };
        }
        return { ok: false, reason: "network-error" };
      }
    }

    return { ok: false, reason: "too-many-redirects" };
  };
}

/**
 * Fetch defensivo de una URL de referencia con el guard anti-SSRF REAL.
 * Nunca lanza: captura todo y devuelve un `SafeFetchResult` estructurado.
 */
export const safeFetch = createSafeFetch({ isForbidden: isForbiddenAddress });
