import { describe, expect, test } from "vitest";
import { classifyPixelbotPath, type PixelbotMethod } from "./pixelbot-paths";

/**
 * Las 16 formas del contrato interno, con el método que las hace legítimas.
 * Si PixelBot estrena una ruta, esta tabla es el sitio donde tiene que
 * declararse: el clasificador es cerrado y lo no declarado no sale.
 */
const RUTAS_VALIDAS: Array<[string, PixelbotMethod, "read" | "write" | "send_message"]> = [
  ["/internal/config", "GET", "read"],
  ["/internal/config/versions", "GET", "read"],
  ["/internal/conversations", "GET", "read"],
  ["/internal/conversations/%2B5213221234567/messages", "GET", "read"],
  ["/internal/examples", "GET", "read"],
  ["/internal/memory", "GET", "read"],

  ["/internal/config", "PUT", "write"],
  ["/internal/config/draft", "POST", "write"],
  ["/internal/config/publish", "POST", "write"],
  ["/internal/config/rollback", "POST", "write"],
  ["/internal/conversations/read", "POST", "write"],
  ["/internal/conversations/mode", "POST", "write"],
  ["/internal/examples", "POST", "write"],
  ["/internal/examples/7/active", "POST", "write"],
  ["/internal/simulate", "POST", "write"],

  ["/internal/send", "POST", "send_message"],
];

describe("classifyPixelbotPath — rutas conocidas", () => {
  test.each(RUTAS_VALIDAS)("%s [%s] → %s", (path, method, operacion) => {
    expect(classifyPixelbotPath(path, method)).toBe(operacion);
  });

  test("la tabla cubre las 16 formas: 6 read, 9 write, 1 send_message", () => {
    const porOperacion = RUTAS_VALIDAS.reduce<Record<string, number>>((acc, [, , op]) => {
      acc[op] = (acc[op] ?? 0) + 1;
      return acc;
    }, {});
    expect(porOperacion).toEqual({ read: 6, write: 9, send_message: 1 });
    expect(RUTAS_VALIDAS).toHaveLength(16);
  });

  test("la query no altera la clasificación", () => {
    expect(classifyPixelbotPath("/internal/conversations?tenant_id=abc", "GET")).toBe("read");
    expect(classifyPixelbotPath("/internal/examples?active_only=true", "GET")).toBe("read");
    expect(classifyPixelbotPath("/internal/memory?phone=%2B5213221234567", "GET")).toBe("read");
    expect(
      classifyPixelbotPath(
        "/internal/conversations/%2B5213221234567/messages?tenant_id=abc&limit=200",
        "GET"
      )
    ).toBe("read");
  });
});

describe("classifyPixelbotPath — el método forma parte de la identidad", () => {
  // `/internal/config` es lectura con GET y mutación con PUT. Clasificar solo
  // por ruta le daría a una escritura el permiso de una lectura.
  test("mismo path, distinto permiso según método", () => {
    expect(classifyPixelbotPath("/internal/config", "GET")).toBe("read");
    expect(classifyPixelbotPath("/internal/config", "PUT")).toBe("write");
    expect(classifyPixelbotPath("/internal/examples", "GET")).toBe("read");
    expect(classifyPixelbotPath("/internal/examples", "POST")).toBe("write");
  });

  test.each([
    ["/internal/config", "POST"],
    ["/internal/send", "GET"],
    ["/internal/send", "PUT"],
    ["/internal/simulate", "GET"],
    ["/internal/config/draft", "GET"],
    ["/internal/config/versions", "POST"],
    ["/internal/memory", "POST"],
    ["/internal/conversations/mode", "GET"],
    ["/internal/conversations/%2B521/messages", "POST"],
    ["/internal/examples/7/active", "GET"],
  ] as Array<[string, PixelbotMethod]>)("método incorrecto bloquea: %s [%s]", (path, method) => {
    expect(classifyPixelbotPath(path, method)).toBeNull();
  });
});

describe("classifyPixelbotPath — formas hostiles", () => {
  test.each([
    ["URL absoluta http", "http://evil.example.com/internal/send"],
    ["URL absoluta https", "https://evil.example.com/internal/send"],
    ["esquema file", "file:///etc/passwd"],
    ["protocol-relative", "//evil.example.com/internal/send"],
    ["traversal simple", "/internal/../admin/secrets"],
    ["traversal dentro de ruta válida", "/internal/examples/../../admin"],
    ["traversal codificado minúscula", "/internal/%2e%2e/admin"],
    ["traversal codificado mayúscula", "/internal/%2E%2E/admin"],
    ["backslash", "/internal\\send"],
    ["backslash mixto", "/internal/config\\..\\admin"],
    ["espacio", "/internal/send con espacio"],
    ["salto de línea (inyección de cabecera)", "/internal/send\nX-Otro: 1"],
    ["retorno de carro", "/internal/send\r\nX-Otro: 1"],
    ["tabulador", "/internal/send\tx"],
  ])("bloquea %s", (_caso, path) => {
    expect(classifyPixelbotPath(path, "POST")).toBeNull();
    expect(classifyPixelbotPath(path, "GET")).toBeNull();
    expect(classifyPixelbotPath(path, "PUT")).toBeNull();
  });

  test.each([
    ["prefijo distinto", "/admin/config"],
    ["prefijo parecido pero no igual", "/internalx/config"],
    ["raíz", "/"],
    ["vacío", ""],
    ["solo el prefijo", "/internal/"],
    ["ruta desconocida", "/internal/desconocida"],
    ["ruta futura no declarada", "/internal/config/delete"],
    ["subruta inventada bajo una válida", "/internal/send/all"],
    ["sin barra inicial", "internal/send"],
  ])("bloquea %s", (_caso, path) => {
    expect(classifyPixelbotPath(path, "POST")).toBeNull();
  });

  test("una ruta nueva NO queda autorizada automáticamente", () => {
    // El día que PixelBot añada /internal/broadcast, esto debe seguir en null
    // hasta que alguien lo declare con una operación explícita.
    expect(classifyPixelbotPath("/internal/broadcast", "POST")).toBeNull();
    expect(classifyPixelbotPath("/internal/admin/purge", "POST")).toBeNull();
    expect(classifyPixelbotPath("/internal/tenants", "GET")).toBeNull();
  });
});

describe("classifyPixelbotPath — segmentos dinámicos estrictos", () => {
  test("id de ejemplo: solo dígitos", () => {
    expect(classifyPixelbotPath("/internal/examples/1/active", "POST")).toBe("write");
    expect(classifyPixelbotPath("/internal/examples/99999/active", "POST")).toBe("write");
  });

  test.each([
    ["no numérico", "/internal/examples/abc/active"],
    ["traversal como id", "/internal/examples/..%2f..%2fadmin/active"],
    ["id vacío", "/internal/examples//active"],
    ["id con barra extra", "/internal/examples/1/2/active"],
    ["id negativo", "/internal/examples/-1/active"],
    ["id decimal", "/internal/examples/1.5/active"],
    ["id con sufijo", "/internal/examples/1x/active"],
  ])("bloquea id %s", (_caso, path) => {
    expect(classifyPixelbotPath(path, "POST")).toBeNull();
  });

  test("teléfono: acepta la forma que produce encodeURIComponent", () => {
    expect(classifyPixelbotPath("/internal/conversations/%2B5213221234567/messages", "GET")).toBe(
      "read"
    );
    expect(classifyPixelbotPath("/internal/conversations/5213221234567/messages", "GET")).toBe(
      "read"
    );
  });

  test.each([
    ["barra cruda", "/internal/conversations/521/322/messages"],
    ["teléfono vacío", "/internal/conversations//messages"],
    ["carácter no permitido", "/internal/conversations/521<322>/messages"],
    ["comillas", '/internal/conversations/521"322/messages'],
    ["ampersand", "/internal/conversations/521&x=1/messages"],
  ])("bloquea teléfono con %s", (_caso, path) => {
    expect(classifyPixelbotPath(path, "GET")).toBeNull();
  });
});
