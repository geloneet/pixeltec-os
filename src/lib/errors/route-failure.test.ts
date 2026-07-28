import { describe, expect, test } from "vitest";
import { SafeUserError } from "@/lib/ai/errors";
import { EgressBlockedError } from "@/lib/egress-guard";
import { VpsTransportError } from "@/lib/vpsClient";
import { toRouteFailure, type RouteFailure } from "./route-failure";

/**
 * Contrato de saneamiento en la frontera HTTP.
 *
 * Lo que se prueba no es la redacción del mensaje, sino su **procedencia**: un
 * error del que no sabemos nada no aporta ni un carácter a la respuesta. Los
 * casos cubren las cuatro formas en que un error llega en producción —Error,
 * objeto con `message`, primitivo, `null`— porque el patrón anterior
 * (`String(err)`) las trataba todas igual de mal.
 */

const FALLBACK: RouteFailure = {
  code: "internal_error",
  message: "No se pudo completar la operación.",
  status: 500,
};

/**
 * Marcadores sensibles. Cada uno representa una clase de dato que se filtraba
 * por el patrón anterior: SQL de Drizzle, identificadores de esquema, nombres
 * de variables de entorno, datos de cliente, credenciales y stacks.
 */
const RAW_SQL = "SELECT * FROM pixelforge_qa_runs WHERE id = $1";
const TABLE_SECRET = "pixelforge_qa_runs.error";
const ENV_SECRET_NAME = "VPS_API_SECRET";
const CLIENTE_CONFIDENCIAL = "Clínica Smile More — +5213221234567";
const TOKEN_PRIVADO = "EAAG9ZBx0kZCZBsBO1ZC7tokenprivadodemeta";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/db/index.ts:42:11)";

const MARCADORES = [
  RAW_SQL,
  TABLE_SECRET,
  ENV_SECRET_NAME,
  CLIENTE_CONFIDENCIAL,
  TOKEN_PRIVADO,
  STACK_INTERNO,
];

/** Todo lo que puede cruzar hacia el cliente, aplanado para inspección. */
function serializar(failure: RouteFailure): string {
  return JSON.stringify(failure);
}

function esperarSinFugas(failure: RouteFailure) {
  const salida = serializar(failure);
  for (const marcador of MARCADORES) {
    expect(salida).not.toContain(marcador);
  }
}

/** Un `message` que reúne todas las clases de dato sensible a la vez. */
const MESSAGE_ENVENENADO = [
  STACK_INTERNO,
  RAW_SQL,
  `columna ${TABLE_SECRET}`,
  `env ${ENV_SECRET_NAME} is not set`,
  CLIENTE_CONFIDENCIAL,
  `token=${TOKEN_PRIVADO}`,
].join(" | ");

describe("toRouteFailure — un error desconocido no aporta nada", () => {
  test("un Error con message envenenado devuelve el fallback intacto", () => {
    const failure = toRouteFailure(new Error(MESSAGE_ENVENENADO), FALLBACK);

    expect(failure).toEqual(FALLBACK);
    esperarSinFugas(failure);
  });

  test("un Error corriente tampoco aporta su message, aunque parezca inofensivo", () => {
    // El punto: no se juzga el contenido. No hay lista de patrones que filtrar,
    // porque cualquier heurística deja pasar el caso que no se anticipó.
    const failure = toRouteFailure(new Error("algo salió mal"), FALLBACK);

    expect(failure).toEqual(FALLBACK);
    expect(serializar(failure)).not.toContain("algo salió mal");
  });

  test("un objeto plano con message no se inspecciona", () => {
    // Los SDK que no heredan de Error son el caso que `instanceof Error`
    // dejaba caer en `String(err)` → "[object Object]" en el mejor caso, y el
    // objeto serializado entero en el peor.
    const failure = toRouteFailure({ message: MESSAGE_ENVENENADO, code: 42 }, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    esperarSinFugas(failure);
  });

  test("un string lanzado tal cual no se propaga", () => {
    const failure = toRouteFailure(MESSAGE_ENVENENADO, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    esperarSinFugas(failure);
  });

  test("null y undefined devuelven el fallback sin romper", () => {
    expect(toRouteFailure(null, FALLBACK)).toEqual(FALLBACK);
    expect(toRouteFailure(undefined, FALLBACK)).toEqual(FALLBACK);
  });

  test("un SyntaxError de `req.json()` no revela el offset del payload", () => {
    // Forma real de undici ante un cuerpo malformado.
    const err = new SyntaxError(
      `Unexpected token } in JSON at position 42 while parsing ${CLIENTE_CONFIDENCIAL}`
    );
    const failure = toRouteFailure(err, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    expect(serializar(failure)).not.toContain("position 42");
    esperarSinFugas(failure);
  });

  test("un error de Drizzle/postgres no revela SQL ni esquema", () => {
    // Forma sintética de un `PostgresError`: además del message, lleva campos
    // propios (`query`, `table`, `detail`) que una serialización ingenua
    // arrastraría entera.
    const drizzleError = Object.assign(
      new Error(`null value in column "error" violates not-null constraint`),
      {
        name: "PostgresError",
        code: "23502",
        query: RAW_SQL,
        table: TABLE_SECRET,
        detail: CLIENTE_CONFIDENCIAL,
        stack: STACK_INTERNO,
      }
    );

    const failure = toRouteFailure(drizzleError, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    esperarSinFugas(failure);
  });

  test("una clase ajena que se hace pasar por segura por su `name` no cuela", () => {
    // El reconocimiento es por `instanceof`, no por el string `name` —que es
    // escribible y por tanto no es una prueba de nada.
    const impostor = Object.assign(new Error(MESSAGE_ENVENENADO), {
      name: "SafeUserError",
      code: "operation_failed",
    });

    const failure = toRouteFailure(impostor, FALLBACK);

    expect(failure).toEqual(FALLBACK);
    esperarSinFugas(failure);
  });
});

describe("toRouteFailure — las clases seguras conservan lo que es nuestro", () => {
  test("SafeUserError conserva su mensaje y su código: lo redactamos nosotros", () => {
    const err = new SafeUserError(
      "Créditos insuficientes. Necesitas 6, tienes 2.",
      "insufficient_credits"
    );
    const failure = toRouteFailure(err, FALLBACK);

    expect(failure).toEqual({
      code: "insufficient_credits",
      message: "Créditos insuficientes. Necesitas 6, tienes 2.",
      status: 500,
    });
  });

  test("EgressBlockedError se distingue del fallo de proveedor, sin citar la topología", () => {
    const err = new EgressBlockedError({
      channel: "vps",
      operation: "deploy",
      reason: "target_not_allowed",
    });
    const failure = toRouteFailure(err, FALLBACK);

    // El código lo distingue de un fallo de red —que es el punto: una política
    // incompleta no debe disfrazarse de "error de conexión".
    expect(failure.code).toBe("egress_blocked");
    // Pero canal, operación y motivo son topología interna: no viajan.
    expect(failure.message).toBe(FALLBACK.message);
    const salida = serializar(failure);
    expect(salida).not.toContain("target_not_allowed");
    expect(salida).not.toContain("deploy");
  });

  test("VpsTransportError conserva código y status upstream, pero no su message", () => {
    const err = new VpsTransportError("vps_redirect_blocked", 302);
    const failure = toRouteFailure(err, FALLBACK);

    expect(failure).toEqual({
      code: "vps_redirect_blocked",
      message: FALLBACK.message,
      status: 500,
      upstreamStatus: 302,
    });
    // El prefijo interno de la clase no viaja.
    expect(serializar(failure)).not.toContain("VPS_TRANSPORT_ERROR");
  });

  test("VpsTransportError sin status upstream omite el campo, no lo inventa", () => {
    const err = new VpsTransportError("vps_unreachable");
    const failure = toRouteFailure(err, FALLBACK);

    expect(failure).toEqual({
      code: "vps_unreachable",
      message: FALLBACK.message,
      status: 500,
    });
    expect(failure.upstreamStatus).toBeUndefined();
  });

  test("el status HTTP es siempre el nuestro, nunca el del upstream", () => {
    // Que el vps-api conteste 502 no convierte nuestra respuesta en un 502.
    const failure = toRouteFailure(new VpsTransportError("vps_invalid_response", 502), FALLBACK);

    expect(failure.status).toBe(500);
    expect(failure.upstreamStatus).toBe(502);
  });
});

describe("toRouteFailure — el fallback manda", () => {
  test("el fallback se devuelve tal cual, sin mutarlo", () => {
    const fallback: RouteFailure = {
      code: "deploy_failed",
      message: "No se pudo desplegar.",
      status: 503,
    };
    const copia = { ...fallback };

    toRouteFailure(new Error(MESSAGE_ENVENENADO), fallback);

    expect(fallback).toEqual(copia);
  });

  test("un fallback específico de operación sobrevive al saneamiento", () => {
    const failure = toRouteFailure(new Error(MESSAGE_ENVENENADO), {
      code: "backup_failed",
      message: "No se pudo crear el respaldo.",
      status: 500,
    });

    expect(failure.code).toBe("backup_failed");
    expect(failure.message).toBe("No se pudo crear el respaldo.");
  });
});
