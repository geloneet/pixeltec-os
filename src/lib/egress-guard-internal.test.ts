import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  assertInternalEgressAllowed,
  assertVpsEgressAllowed,
  assertWhatsAppEgressAllowed,
  EgressBlockedError,
  type InternalOperation,
} from "./egress-guard";

/**
 * Política del canal `internal` (E0e).
 *
 * Este canal transporta un secreto compartido en cada petición, así que la
 * pregunta que guía estos casos no es «¿deja pasar lo permitido?» sino «¿qué
 * haría falta para que dejara pasar algo que no debería?».
 */

const ENV_TOCADAS = [
  "EGRESS_INTERNAL_MODE",
  "EGRESS_INTERNAL_TARGET_ALLOWLIST",
  "EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION",
  "EGRESS_DEFAULT_MODE",
  "EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION",
  "EGRESS_WHATSAPP_MODE",
  "EGRESS_WHATSAPP_ALLOWLIST",
  "EGRESS_VPS_MODE",
  "EGRESS_VPS_HOST_ALLOWLIST",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const clave of ENV_TOCADAS) {
    original[clave] = process.env[clave];
    delete process.env[clave];
  }
});

afterEach(() => {
  for (const clave of ENV_TOCADAS) {
    if (original[clave] === undefined) delete process.env[clave];
    else process.env[clave] = original[clave];
  }
});

/** Configuración que autoriza: los casos que prueban un solo desvío parten de aquí. */
function configurarPermisivo(allowlist = "pixelbot:pixelbot:3011") {
  process.env.EGRESS_INTERNAL_MODE = "allowlist";
  process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = allowlist;
}

function llamar(
  rawUrl: string | undefined,
  operation: InternalOperation = "read",
  service = "pixelbot"
) {
  return () => assertInternalEgressAllowed({ service, rawUrl, operation });
}

function razonDeBloqueo(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof EgressBlockedError) return err.reason;
    throw err;
  }
  throw new Error("se esperaba EgressBlockedError y no hubo bloqueo");
}

describe("canal internal — modo", () => {
  test("modo ausente bloquea: no hay default permisivo", () => {
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("mode_disabled");
  });

  test("modo disabled bloquea", () => {
    process.env.EGRESS_INTERNAL_MODE = "disabled";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("mode_disabled");
  });

  test("modo vacío bloquea como inválido, no cae al default", () => {
    process.env.EGRESS_INTERNAL_MODE = "";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("mode_invalid");
  });

  test.each(["allowlis", "ALLOWLISTED", "on", "true", "enabled", "1", "yes"])(
    "modo desconocido %s bloquea como inválido",
    (modo) => {
      process.env.EGRESS_INTERNAL_MODE = modo;
      process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
      expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("mode_invalid");
    }
  );
});

describe("canal internal — allowlist", () => {
  test("allowlist vacía bloquea aunque el modo sea allowlist", () => {
    process.env.EGRESS_INTERNAL_MODE = "allowlist";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("allowlist_empty");
  });

  test("target exacto permitido", () => {
    configurarPermisivo();
    expect(llamar("http://pixelbot:3011")).not.toThrow();
  });

  test("loopback permitido cuando está en la lista", () => {
    configurarPermisivo("pixelbot:127.0.0.1:3011");
    expect(llamar("http://127.0.0.1:3011")).not.toThrow();
  });

  test("localhost permitido cuando está en la lista", () => {
    configurarPermisivo("pixelbot:localhost:3011");
    expect(llamar("http://localhost:3011")).not.toThrow();
  });

  test("varias entradas: cada una autoriza solo lo suyo", () => {
    configurarPermisivo("pixelbot:pixelbot:3011,pixelbot:127.0.0.1:3011");
    expect(llamar("http://pixelbot:3011")).not.toThrow();
    expect(llamar("http://127.0.0.1:3011")).not.toThrow();
    expect(razonDeBloqueo(llamar("http://localhost:3011"))).toBe("target_not_allowed");
  });

  test.each([
    ["puerto distinto", "http://pixelbot:3012"],
    ["puerto por defecto implícito", "http://pixelbot"],
    ["servicio distinto en el host", "http://otrobot:3011"],
  ])("coincidencia parcial bloqueada: %s", (_caso, url) => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar(url))).toBe("target_not_allowed");
  });

  test("la comparación es exacta, no por prefijo", () => {
    configurarPermisivo("pixelbot:pixelbot:3011");
    // "pixelbot:pixelbot:30110" contiene la entrada autorizada como prefijo.
    expect(razonDeBloqueo(llamar("http://pixelbot:30110"))).toBe("target_not_allowed");
  });

  test("un servicio distinto no hereda la autorización del host", () => {
    configurarPermisivo("pixelbot:pixelbot:3011");
    expect(razonDeBloqueo(llamar("http://pixelbot:3011", "read", "otroservicio"))).toBe(
      "target_not_allowed"
    );
  });

  test("servicio vacío bloquea", () => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar("http://pixelbot:3011", "read", "   "))).toBe("target_missing");
  });
});

describe("canal internal — restricción dura de red (por encima de la allowlist)", () => {
  test("dominio público bloqueado AUNQUE esté en la allowlist", () => {
    configurarPermisivo("pixelbot:evil.example.com:3011");
    expect(razonDeBloqueo(llamar("http://evil.example.com:3011"))).toBe("target_invalid");
  });

  test("IP pública bloqueada AUNQUE esté en la allowlist", () => {
    configurarPermisivo("pixelbot:203.0.113.10:3011");
    expect(razonDeBloqueo(llamar("http://203.0.113.10:3011"))).toBe("target_invalid");
  });

  test("https hacia dominio público también bloqueado", () => {
    configurarPermisivo("pixelbot:api.pixeltec.mx:443");
    expect(razonDeBloqueo(llamar("https://api.pixeltec.mx"))).toBe("target_invalid");
  });

  test.each([
    ["ftp", "ftp://pixelbot:3011"],
    ["file", "file:///etc/passwd"],
    ["gopher", "gopher://pixelbot:3011"],
    ["data", "data:text/plain,hola"],
  ])("protocolo incorrecto bloqueado: %s", (_caso, url) => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar(url))).toBe("target_invalid");
  });

  test.each([
    ["usuario", "http://alguien@pixelbot:3011"],
    ["usuario y contraseña", "http://alguien:secreto@pixelbot:3011"],
  ])("credenciales embebidas bloqueadas: %s", (_caso, url) => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar(url))).toBe("target_invalid");
  });

  test("URL inválida bloqueada", () => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar("no-es-una-url"))).toBe("target_invalid");
  });

  test("URL ausente o en blanco bloqueada", () => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar(undefined))).toBe("target_missing");
    expect(razonDeBloqueo(llamar(""))).toBe("target_missing");
    expect(razonDeBloqueo(llamar("   "))).toBe("target_missing");
  });
});

describe("canal internal — send_message tiene permiso propio", () => {
  test("bloqueado fuera de producción sin el reconocimiento", () => {
    configurarPermisivo();
    expect(razonDeBloqueo(llamar("http://pixelbot:3011", "send_message"))).toBe(
      "send_not_authorized"
    );
  });

  test("read y write no lo necesitan", () => {
    configurarPermisivo();
    expect(llamar("http://pixelbot:3011", "read")).not.toThrow();
    expect(llamar("http://pixelbot:3011", "write")).not.toThrow();
  });

  test("exactamente 'true' autoriza", () => {
    configurarPermisivo();
    process.env.EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION = "true";
    expect(llamar("http://pixelbot:3011", "send_message")).not.toThrow();
  });

  test("'true' con espacios o mayúsculas también autoriza: solo se normaliza", () => {
    configurarPermisivo();
    process.env.EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION = "  TRUE  ";
    expect(llamar("http://pixelbot:3011", "send_message")).not.toThrow();
  });

  test.each(["1", "yes", "enabled", "on", "sí", "y", "", "false", "TRUEISH"])(
    "%s NO autoriza",
    (valor) => {
      configurarPermisivo();
      process.env.EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION = valor;
      expect(razonDeBloqueo(llamar("http://pixelbot:3011", "send_message"))).toBe(
        "send_not_authorized"
      );
    }
  );

  test("el reconocimiento de send NO relaja modo ni allowlist", () => {
    process.env.EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION = "true";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011", "send_message"))).toBe("mode_disabled");

    configurarPermisivo("pixelbot:otro:3011");
    expect(razonDeBloqueo(llamar("http://pixelbot:3011", "send_message"))).toBe(
      "target_not_allowed"
    );
  });
});

describe("canal internal — aislamiento entre canales", () => {
  test("habilitar internal no habilita WhatsApp", () => {
    configurarPermisivo();
    expect(() => assertWhatsAppEgressAllowed("+5213221234567")).toThrow(EgressBlockedError);
  });

  test("habilitar internal no habilita VPS", () => {
    configurarPermisivo();
    expect(() => assertVpsEgressAllowed("https://api.pixeltec.mx", "deploy")).toThrow(
      EgressBlockedError
    );
  });

  test("habilitar WhatsApp no habilita internal", () => {
    process.env.EGRESS_WHATSAPP_MODE = "allowlist";
    process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5213221234567";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("mode_disabled");
  });

  test("EGRESS_DEFAULT_MODE=allowlist no regala destinos: la lista sigue vacía", () => {
    process.env.EGRESS_DEFAULT_MODE = "allowlist";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("allowlist_empty");
  });

  test("modo live fuera de producción exige reconocimiento, y la lista se cumple igual", () => {
    process.env.EGRESS_INTERNAL_MODE = "live";
    process.env.EGRESS_INTERNAL_TARGET_ALLOWLIST = "pixelbot:pixelbot:3011";
    expect(razonDeBloqueo(llamar("http://pixelbot:3011"))).toBe("live_outside_production");

    // Con el reconocimiento pasa, pero un destino fuera de lista sigue bloqueado:
    // la allowlist se exige SIEMPRE en este canal, también en `live`.
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    expect(llamar("http://pixelbot:3011")).not.toThrow();
    expect(razonDeBloqueo(llamar("http://pixelbot:9999"))).toBe("target_not_allowed");
  });
});

describe("canal internal — el error no filtra el destino", () => {
  const NUNCA = ["pixelbot", "3011", "evil.example.com", "203.0.113.10", "alguien", "secreto"];

  test("ni el mensaje ni las propiedades citan host, puerto o credenciales", () => {
    configurarPermisivo("pixelbot:evil.example.com:3011");
    let capturado: EgressBlockedError | undefined;
    try {
      assertInternalEgressAllowed({
        service: "pixelbot",
        rawUrl: "http://alguien:secreto@evil.example.com:3011",
        operation: "send_message",
      });
    } catch (err) {
      capturado = err as EgressBlockedError;
    }

    expect(capturado).toBeInstanceOf(EgressBlockedError);
    const serializado = [
      capturado?.message,
      capturado?.channel,
      capturado?.operation,
      capturado?.reason,
      JSON.stringify(capturado),
    ].join(" ");

    for (const fragmento of NUNCA) {
      expect(serializado).not.toContain(fragmento);
    }
  });

  test("el mensaje solo transporta canal, operación y razón", () => {
    configurarPermisivo();
    expect(() =>
      assertInternalEgressAllowed({
        service: "pixelbot",
        rawUrl: "http://pixelbot:9999",
        operation: "write",
      })
    ).toThrow("EGRESS_BLOCKED: internal/write (target_not_allowed)");
  });

  test("las propiedades expuestas son solo las tres estables", () => {
    configurarPermisivo();
    try {
      assertInternalEgressAllowed({
        service: "pixelbot",
        rawUrl: "http://pixelbot:9999",
        operation: "read",
      });
    } catch (err) {
      const e = err as EgressBlockedError;
      expect(e.channel).toBe("internal");
      expect(e.operation).toBe("read");
      expect(e.reason).toBe("target_not_allowed");
      expect(e.code).toBe("EGRESS_BLOCKED");
    }
  });
});
