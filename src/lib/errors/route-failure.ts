/**
 * Saneamiento de errores en la frontera HTTP (E0f-2, G-04).
 *
 * Toda ruta de `src/app/api` que atrapa una excepción y responde al cliente
 * pasa por aquí. El módulo existe porque el patrón que había en su lugar
 * —`err instanceof Error ? err.message : String(err)`— es **fail-open**: por
 * defecto propaga el texto de un error del que no sabemos nada. Basta con que
 * una consulta de Drizzle, un `req.json()` malformado o un `process.env`
 * ausente caigan en ese `catch` para que el cliente reciba SQL, nombres de
 * columna o el nombre de una variable de entorno.
 *
 * La regla es la inversa: **un error desconocido no aporta ni un carácter a la
 * respuesta**. No se lee su `message`, no se le aplica `String()`, no se
 * serializa y no se trunca. Truncar sería peor que inútil: el primer fragmento
 * es justo donde los SDK y los drivers colocan el eco del payload.
 *
 * Es el mismo criterio que `toSafeFailure` (`lib/ai/errors.ts`) y
 * `toInboxFailure` (`lib/whatsapp-inbox/errors.ts`) ya aplican en sus dominios.
 * Este módulo NO los reemplaza ni los envuelve: vive aparte a propósito, porque
 * acoplar las rutas de VPS, Meta y PixelForge a `lib/ai` sería una frontera
 * arquitectónica equivocada.
 *
 * ## Qué se reconoce aquí y qué no
 *
 * Se reconocen las clases seguras cuyo módulo es barato de importar
 * (`egress-guard` no tiene dependencias; `ai/errors` y `vpsClient` sólo
 * dependen de él). `QaRunAlreadyActiveError` **no** se reconoce aquí: vive en
 * `lib/db/repos/pixelforge.ts`, 2724 líneas que arrastran Drizzle, `postgres` y
 * R2. Importarlo obligaría a las 14 rutas de `/api/vps` a cargar el ORM entero
 * para nada. Esa clase se trata con un `instanceof` explícito en la ruta de QA,
 * que ya la tiene importada — ver `api/pixelforge/qa/runs/route.ts`.
 */
import { NextResponse } from "next/server";
import { EgressBlockedError } from "@/lib/egress-guard";
import { SafeUserError } from "@/lib/ai/errors";
import { VpsTransportError } from "@/lib/vpsClient";

/**
 * Lo único que puede cruzar hacia una respuesta HTTP.
 *
 * `status` es el código HTTP de **nuestra** respuesta, no el del upstream: que
 * el vps-api conteste 502 no convierte nuestra respuesta en un 502.
 */
export type RouteFailure = {
  /** Etiqueta estable para que el cliente discrimine sin parsear texto. */
  code: string;
  /** Mensaje redactado por nosotros. Jamás el `message` de un desconocido. */
  message: string;
  /** Status HTTP de la respuesta que emitimos. */
  status: number;
  /**
   * Status que devolvió un servicio upstream, cuando lo hubo y es seguro.
   * Es un número: no transporta texto, y por eso puede viajar. Sirve para que
   * soporte distinga "el VPS contestó 502" de "no se pudo conectar".
   */
  upstreamStatus?: number;
};

/**
 * Traduce cualquier excepción a una `RouteFailure`.
 *
 * `fallback` es la respuesta para todo lo que no esté demostrado como seguro, y
 * es lo que se emite en el caso dominante. Conviene que sea específico de la
 * operación ("No se pudo desplegar") en vez de genérico: es el único texto que
 * el usuario va a ver.
 */
export function toRouteFailure(error: unknown, fallback: RouteFailure): RouteFailure {
  // Mensaje literal nuestro por construcción: la clase existe justamente para
  // poder distinguirlo en runtime de un `new Error(...)` cualquiera.
  if (error instanceof SafeUserError) {
    return { code: error.code, message: error.message, status: fallback.status };
  }

  // La llamada no llegó a salir por política de egress. Se distingue del fallo
  // de proveedor a propósito: confundirlos esconde una configuración incompleta
  // detrás de un "error de red". El `message` de la clase cita canal, operación
  // y motivo —topología interna—, así que no se usa.
  if (error instanceof EgressBlockedError) {
    return { code: "egress_blocked", message: fallback.message, status: fallback.status };
  }

  // El código es un enum cerrado nuestro (`vps_timeout`, `vps_unreachable`…) y
  // el status es un número. Ambos son seguros. El `message` de la clase no se
  // usa: lleva el prefijo `VPS_TRANSPORT_ERROR:` que es ruido interno.
  if (error instanceof VpsTransportError) {
    return {
      code: error.code,
      message: fallback.message,
      status: fallback.status,
      ...(error.status !== undefined ? { upstreamStatus: error.status } : {}),
    };
  }

  // Desconocido. No se inspecciona de ninguna forma.
  return fallback;
}

/**
 * Respuesta JSON de error a partir de una `RouteFailure`.
 *
 * Existe para que el bloque no se copie catorce veces en `/api/vps`: cada copia
 * es una oportunidad más de que alguien reintroduzca el `err.message`. El
 * campo `error` conserva el nombre que ya consumía la UI de VPS
 * (`(admin)/vps/components/*`); `code` y `upstreamStatus` son añadidos, así que
 * ningún cliente existente se rompe.
 */
export function jsonFailure(failure: RouteFailure): NextResponse {
  return NextResponse.json(
    {
      error: failure.message,
      code: failure.code,
      ...(failure.upstreamStatus !== undefined ? { upstreamStatus: failure.upstreamStatus } : {}),
    },
    { status: failure.status }
  );
}
