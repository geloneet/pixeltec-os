import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSafeFetch, safeFetch } from "./safe-fetch";

/**
 * Servidor http local efímero (127.0.0.1, puerto asignado por el SO) para
 * probar el comportamiento de red de safeFetch (happy path, redirects,
 * límite de bytes, content-type, timeout) SIN salir a internet.
 *
 * Como el server está en 127.0.0.1, el guard REAL de safeFetch lo
 * bloquearía por `forbidden-address` — precisamente lo que se prueba en la
 * sección de SEGURIDAD más abajo. Para probar el resto del comportamiento
 * (que no depende del guard) se usa `createSafeFetch({ isForbidden: () =>
 * false })`, que desactiva el guard, contra este mismo server.
 */
let server: http.Server;
let baseUrl: string;

const HTML_BODY = "<html><head><title>ok</title></head><body>hola</body></html>";
const BIG_BODY = Buffer.alloc(3 * 1024 * 1024, "a"); // 3MB > el límite de 2MB

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    switch (url.pathname) {
      case "/": {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(HTML_BODY);
        return;
      }
      case "/redirect-once": {
        res.writeHead(302, { location: "/" });
        res.end();
        return;
      }
      case "/redirect-chain-a": {
        res.writeHead(302, { location: "/redirect-chain-b" });
        res.end();
        return;
      }
      case "/redirect-chain-b": {
        res.writeHead(302, { location: "/redirect-chain-c" });
        res.end();
        return;
      }
      case "/redirect-chain-c": {
        res.writeHead(302, { location: "/" });
        res.end();
        return;
      }
      case "/redirect-loop": {
        // Siempre redirige a sí mismo: dispara el límite de redirects.
        res.writeHead(302, { location: "/redirect-loop" });
        res.end();
        return;
      }
      case "/big": {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(BIG_BODY);
        return;
      }
      case "/notjson": {
        res.writeHead(200, { "content-type": "application/json" });
        res.end('{"a":1}');
        return;
      }
      case "/hang": {
        // Manda headers pero JAMÁS cierra la respuesta: fuerza el timeout.
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return;
      }
      default: {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

describe("createSafeFetch — comportamiento de red (guard desactivado, servidor local)", () => {
  // `isPortAllowed: () => true` es necesario SOLO para estos tests: el
  // server efímero de prueba corre en un puerto asignado por el SO (no
  // privilegiado — 80/443 requieren root, inviable en un entorno de test/CI
  // sin privilegios). `safeFetch` (el export real, probado en la sección de
  // SEGURIDAD) NUNCA sobreescribe `isPortAllowed` — sigue restringido a
  // 80/443 reales.
  const localFetch = () => createSafeFetch({ isForbidden: () => false, isPortAllowed: () => true });

  it("fetchea HTML válido y devuelve status/contentType/body/finalUrl", async () => {
    const result = await localFetch()(`${baseUrl}/`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(200);
    expect(result.contentType).toContain("text/html");
    expect(result.body).toBe(HTML_BODY);
    expect(result.finalUrl).toBe(`${baseUrl}/`);
  });

  it("sigue un redirect 302 hasta el destino final", async () => {
    const result = await localFetch()(`${baseUrl}/redirect-once`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe(HTML_BODY);
    expect(result.finalUrl).toBe(`${baseUrl}/`);
  });

  it("sigue hasta 3 redirects encadenados y llega al destino", async () => {
    const result = await localFetch()(`${baseUrl}/redirect-chain-a`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toBe(HTML_BODY);
  });

  it("un 4to redirect excede el límite → too-many-redirects", async () => {
    const result = await localFetch()(`${baseUrl}/redirect-loop`);
    expect(result).toEqual({ ok: false, reason: "too-many-redirects" });
  });

  it("content-type que no es text/html → not-html", async () => {
    const result = await localFetch()(`${baseUrl}/notjson`);
    expect(result).toEqual({ ok: false, reason: "not-html" });
  });

  it("cuerpo que excede 2MB → too-large", async () => {
    const result = await localFetch()(`${baseUrl}/big`);
    expect(result).toEqual({ ok: false, reason: "too-large" });
  });

  it("puerto no permitido (22) → forbidden-port, sin conectar", async () => {
    // A propósito NO usa `localFetch()`: se quiere la política de puertos
    // REAL (80/443 solamente), no la relajada para conectar al server de
    // prueba.
    const strictPortFetch = createSafeFetch({ isForbidden: () => false });
    const result = await strictPortFetch("http://127.0.0.1:22/");
    expect(result).toEqual({ ok: false, reason: "forbidden-port" });
  });

  it("credenciales embebidas en la URL → credentials-in-url, sin conectar", async () => {
    const result = await localFetch()(`http://user:pass@127.0.0.1:${new URL(baseUrl).port}/`);
    expect(result).toEqual({ ok: false, reason: "credentials-in-url" });
  });

  it("esquema no http/https → forbidden-scheme", async () => {
    const result = await localFetch()("ftp://127.0.0.1/archivo");
    expect(result).toEqual({ ok: false, reason: "forbidden-scheme" });
  });

  it("URL inválida → invalid-url", async () => {
    const result = await localFetch()("no-es-una-url");
    expect(result).toEqual({ ok: false, reason: "invalid-url" });
  });

  it(
    "servidor que nunca termina la respuesta → timeout",
    { timeout: 15_000 },
    async () => {
      const result = await localFetch()(`${baseUrl}/hang`);
      expect(result).toEqual({ ok: false, reason: "timeout" });
    },
  );
});

describe("safeFetch — SEGURIDAD (guard REAL, anti-SSRF)", () => {
  it("bloquea loopback (127.0.0.1, puerto por defecto 80/443) por forbidden-address, ANTES de conectar", async () => {
    // No usa el server efímero: safeFetch (guard + política de puertos
    // REALES) rechaza esta URL en validateUrl, sin intentar conectar. Con
    // el puerto por defecto (implícito, "" → cae en la allowlist real
    // 80/443) se prueba el bloqueo de dirección específicamente, aislado
    // del chequeo de puerto.
    const result = await safeFetch("http://127.0.0.1/");
    expect(result).toEqual({ ok: false, reason: "forbidden-address" });
  });

  it(
    "bloquea el endpoint de metadata cloud 169.254.169.254 vía el pre-check SÍNCRONO de IP literal " +
      "(hallazgo #1 del spike: options.lookup NUNCA se invoca para hosts que ya son IP, así que este " +
      "es el ÚNICO mecanismo que puede bloquearlo — si el pre-check faltara, esta VM tiene un endpoint " +
      "de metadata real y alcanzable, y la request devolvería 200 con metadata real de instancia)",
    async () => {
      const started = Date.now();
      const result = await safeFetch("http://169.254.169.254/latest/meta-data/");
      const elapsedMs = Date.now() - started;

      expect(result).toEqual({ ok: false, reason: "forbidden-address" });
      // El pre-check es puramente sincrónico (aritmética sobre el string de
      // IP, sin DNS ni socket). Si tomara más de un puñado de ms, sería
      // evidencia de que en realidad se intentó conectar (p.ej. porque el
      // pre-check se salteó y solo quedó el guardedLookup, que aquí es mudo).
      expect(elapsedMs).toBeLessThan(500);
    },
  );

  it(
    "bloquea el bracket-literal IPv6 [::ffff:169.254.169.254] — forma HEX que produce el " +
      "parser de URL para IPv4-mapped en corchetes (regresión: el regex viejo de ip-guard.ts " +
      "solo reconocía la forma dotted y dejaba pasar esta) — SIN conectar (guard real, pre-check síncrono)",
    async () => {
      const started = Date.now();
      const result = await safeFetch("http://[::ffff:169.254.169.254]/");
      const elapsedMs = Date.now() - started;

      expect(result).toEqual({ ok: false, reason: "forbidden-address" });
      expect(elapsedMs).toBeLessThan(500);
    },
  );

  it("bloquea variantes de localhost/loopback vía IP literal (127.0.0.1, 0.0.0.0)", async () => {
    const r1 = await safeFetch("http://127.0.0.1/");
    expect(r1).toEqual({ ok: false, reason: "forbidden-address" });

    const r2 = await safeFetch("http://0.0.0.0/");
    expect(r2).toEqual({ ok: false, reason: "forbidden-address" });
  });

  it("re-valida el pre-check de IP-literal en CADA hop de redirect, no solo en la URL inicial", async () => {
    // Mock con estado: permite el primer hop (la URL original) pero bloquea
    // desde el segundo hop en adelante. El server local usa un guard
    // desactivado (redirige sin que el SERVER sepa nada del guard); lo que
    // se está probando es que `createSafeFetch` invoca `isForbidden` de
    // nuevo al validar la URL de destino del redirect (127.0.0.1 sigue
    // siendo IP literal en el segundo hop), no solo una vez al principio.
    let calls = 0;
    const statefulFetch = createSafeFetch({
      isForbidden: () => {
        calls += 1;
        return calls > 1; // permite el hop 0, bloquea desde el hop 1
      },
      // Puerto relajado únicamente para poder golpear el server de prueba
      // (puerto no privilegiado); lo que se ejercita acá es la
      // re-validación de `isForbidden` por hop, no la política de puertos.
      isPortAllowed: () => true,
    });

    const result = await statefulFetch(`${baseUrl}/redirect-once`);

    expect(result).toEqual({ ok: false, reason: "forbidden-address" });
    // Debe haber corrido el pre-check MÁS de una vez: una por hop.
    expect(calls).toBeGreaterThan(1);
  });

  it("safeFetch nunca lanza: URLs malformadas o rarezas devuelven un resultado, no una excepción", async () => {
    await expect(safeFetch("no-es-una-url")).resolves.toEqual({ ok: false, reason: "invalid-url" });
    await expect(safeFetch("javascript:alert(1)")).resolves.toEqual({
      ok: false,
      reason: "forbidden-scheme",
    });
  });
});
