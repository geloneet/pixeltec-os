import { describe, expect, test } from "vitest";
import { SafeUserError, AiProviderError } from "@/lib/ai/errors";
import { toPublicFailure, type PublicFailure } from "./public-failure";

/**
 * Contrato del núcleo de saneamiento.
 *
 * La lista blanca es de una sola clase a propósito. Lo que se prueba aquí no es
 * que el mensaje sea correcto, sino que **una clase propia no es
 * automáticamente pública**: `GenericDomainError` (definida abajo, solo para
 * esta prueba — antes era `PixelforgeRunError`, retirada en WO-2026-00132)
 * acepta cualquier string en su constructor, así que su texto vale lo que
 * valga quien la lance.
 */

/** Error de dominio genérico, mismo shape que cualquier clase propia que
 *  construye su mensaje con texto libre (p.ej. de un SDK externo). Solo
 *  existe para probar la propiedad, no representa ningún módulo real. */
class GenericDomainError extends Error {
  constructor(public readonly kind: string, message: string) {
    super(message);
    this.name = "GenericDomainError";
  }
}

const FALLBACK: PublicFailure = {
  code: "operation_failed",
  message: "No se pudo completar la operación.",
};

const RAW_SQL = "SELECT * FROM growth_posts WHERE owner_id = $1";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const TOKEN_PRIVADO = "EAAG9ZBx0kZCZBsBO1ZC7tokenprivadodemeta";
const ENV_SECRET_NAME = "DATABASE_URL";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";
const PROVIDER_BODY =
  '{"error":{"type":"invalid_request_error","message":"prompt: Eres un experto..."}}';

const MARCADORES = [
  RAW_SQL,
  CLIENTE_CONFIDENCIAL,
  TOKEN_PRIVADO,
  ENV_SECRET_NAME,
  STACK_INTERNO,
  PROVIDER_BODY,
];

/** Un `message` que reúne las seis clases de dato sensible a la vez. */
const MESSAGE_ENVENENADO = [
  STACK_INTERNO,
  RAW_SQL,
  `env ${ENV_SECRET_NAME} is not set`,
  CLIENTE_CONFIDENCIAL,
  `token=${TOKEN_PRIVADO}`,
  PROVIDER_BODY,
].join(" | ");

function esperarFallbackLimpio(error: unknown) {
  const failure = toPublicFailure(error, FALLBACK);

  expect(failure).toEqual(FALLBACK);
  const salida = JSON.stringify(failure);
  for (const marcador of MARCADORES) {
    expect(salida).not.toContain(marcador);
  }
}

describe("toPublicFailure — la única clase segura es SafeUserError", () => {
  test("SafeUserError conserva su code y su message: lo redactamos nosotros", () => {
    const err = new SafeUserError(
      "Créditos insuficientes. Necesitas 6, tienes 2.",
      "insufficient_credits"
    );

    expect(toPublicFailure(err, FALLBACK)).toEqual({
      code: "insufficient_credits",
      message: "Créditos insuficientes. Necesitas 6, tienes 2.",
    });
  });

  test("un SafeUserError con code por defecto también se conserva", () => {
    const err = new SafeUserError("Marca no encontrada");

    expect(toPublicFailure(err, FALLBACK)).toEqual({
      code: "operation_failed",
      message: "Marca no encontrada",
    });
  });
});

describe("toPublicFailure — que una clase sea nuestra no la vuelve pública", () => {
  test("GenericDomainError NO se preserva: su constructor acepta cualquier string", () => {
    // Es el caso que justifica la lista blanca corta. `new GenericDomainError(kind, message)`
    // representa cualquier error de dominio construido con texto que puede venir de un SDK.
    esperarFallbackLimpio(new GenericDomainError("provider_error", MESSAGE_ENVENENADO));
  });

  test("AiProviderError NO se preserva: su message cita la topología interna", () => {
    // Matiz importante: a diferencia de `GenericDomainError`, esta clase NO
    // acepta texto arbitrario —construye su mensaje con provider/operation/
    // code/status, todos enums nuestros—. Aun así no se preserva, porque decir
    // "anthropic/generate_text falló con 429" describe la arquitectura interna
    // a quien no tiene por qué conocerla. Mismo criterio que `toSafeFailure`.
    const err = new AiProviderError({
      provider: "anthropic",
      operation: "generate_text",
      code: "ai_provider_error",
      status: 429,
    });
    const failure = toPublicFailure(err, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    const salida = JSON.stringify(failure);
    expect(salida).not.toContain("AI_PROVIDER_ERROR");
    expect(salida).not.toContain("anthropic");
    expect(salida).not.toContain("generate_text");
  });

  test("un error con forma de ForbiddenAddressError no se preserva", () => {
    // La clase real es privada de `visual/safe-fetch.ts`; se reproduce su forma
    // porque lo que importa es que citar hostname y dirección no la hace segura.
    class ForbiddenAddressErrorLike extends Error {
      constructor(hostname: string, address: string) {
        super(`Dirección prohibida para "${hostname}": ${address}`);
        this.name = "ForbiddenAddressError";
      }
    }
    esperarFallbackLimpio(new ForbiddenAddressErrorLike("interno.pixeltec.mx", "10.0.0.5"));
  });

  test("un error con forma de SafeFetchInternalError no se preserva", () => {
    class SafeFetchInternalErrorLike extends Error {
      constructor(
        public readonly safeReason: string,
        message: string
      ) {
        super(message);
        this.name = "SafeFetchInternalError";
      }
    }
    esperarFallbackLimpio(new SafeFetchInternalErrorLike("too-large", MESSAGE_ENVENENADO));
  });

  test("un impostor que se hace pasar por SafeUserError por su `name` no cuela", () => {
    // El reconocimiento es por `instanceof`, no por el string `name`, que es
    // escribible y por tanto no prueba nada.
    esperarFallbackLimpio(
      Object.assign(new Error(MESSAGE_ENVENENADO), {
        name: "SafeUserError",
        code: "insufficient_credits",
      })
    );
  });
});

describe("toPublicFailure — lo desconocido no aporta nada", () => {
  test("un Error normal con los seis marcadores devuelve el fallback intacto", () => {
    esperarFallbackLimpio(new Error(MESSAGE_ENVENENADO));
  });

  test("un objeto plano con `message` no se inspecciona", () => {
    esperarFallbackLimpio({ message: MESSAGE_ENVENENADO });
  });

  test("un objeto plano con `code` y `message` tampoco: la forma no es un contrato", () => {
    // Tener las propiedades correctas no demuestra que el texto sea nuestro.
    esperarFallbackLimpio({ code: "parece_seguro", message: MESSAGE_ENVENENADO });
  });

  test("un string lanzado tal cual no se propaga", () => {
    esperarFallbackLimpio(MESSAGE_ENVENENADO);
  });

  test("un número lanzado no rompe ni aporta", () => {
    esperarFallbackLimpio(42);
  });

  test("null y undefined devuelven el fallback", () => {
    expect(toPublicFailure(null, FALLBACK)).toEqual(FALLBACK);
    expect(toPublicFailure(undefined, FALLBACK)).toEqual(FALLBACK);
  });

  test("un SyntaxError de JSON no revela el offset ni el payload", () => {
    const err = new SyntaxError(
      `Unexpected token } in JSON at position 42 while parsing ${CLIENTE_CONFIDENCIAL}`
    );
    const failure = toPublicFailure(err, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    expect(JSON.stringify(failure)).not.toContain("position 42");
  });

  test("un error de Drizzle/postgres no revela SQL, esquema ni stack", () => {
    esperarFallbackLimpio(
      Object.assign(new Error(`null value in column "email" violates not-null constraint`), {
        name: "PostgresError",
        code: "23502",
        query: RAW_SQL,
        detail: CLIENTE_CONFIDENCIAL,
        stack: STACK_INTERNO,
      })
    );
  });
});

describe("toPublicFailure — el fallback manda", () => {
  test("no muta el fallback recibido", () => {
    const fallback: PublicFailure = { code: "seal_failed", message: "No se pudo sellar." };
    const copia = { ...fallback };

    toPublicFailure(new Error(MESSAGE_ENVENENADO), fallback);

    expect(fallback).toEqual(copia);
  });

  test("no devuelve el error original bajo ninguna clave", () => {
    const failure = toPublicFailure(new Error(MESSAGE_ENVENENADO), FALLBACK);

    // Cualquier consumidor que serialice el resultado reintroduciría la fuga.
    expect(Object.keys(failure).sort()).toEqual(["code", "message"]);
  });

  test("un fallback específico de operación sobrevive al saneamiento", () => {
    const failure = toPublicFailure(new Error(MESSAGE_ENVENENADO), {
      code: "pixelforge_seal_artifact_failed",
      message: "No se pudo sellar el artefacto",
    });

    expect(failure.code).toBe("pixelforge_seal_artifact_failed");
    expect(failure.message).toBe("No se pudo sellar el artefacto");
  });
});
