/**
 * Núcleo de saneamiento para todo lo que cruza hacia el exterior (E0f-3a).
 *
 * "Exterior" es cualquier cosa que salga del servidor: el valor de retorno de
 * una Server Action, una respuesta HTTP, una fila persistida que después se
 * sirve, o un log que alguien leerá. La regla es única y no depende del
 * transporte: **un error desconocido no aporta ni un carácter**. No se lee su
 * `message`, no se le aplica `String()`, no se serializa, no se trunca y no se
 * mira el stack.
 *
 * Este módulo es deliberadamente ignorante del transporte. No conoce HTTP, ni
 * el cliente del VPS, ni PixelBot: si lo hiciera, las 22 Server Actions
 * acabarían importando `vpsClient` y las guardas de egress sin usarlas nunca.
 * Las clases propias de una capa se resuelven en esa capa —`route-failure.ts`
 * hace lo suyo con `VpsTransportError` y `EgressBlockedError` antes de delegar
 * aquí— y este núcleo se queda con lo que es común a todas: `SafeUserError` y
 * el descarte de lo desconocido.
 *
 * ## Por qué la lista blanca es tan corta
 *
 * Que una clase de error sea **nuestra** no la vuelve **pública**. El caso que
 * lo demuestra es `PixelforgeRunError` (`lib/pixelforge/ai/failures.ts`): su
 * constructor es `(kind, message: string)`, así que su texto es el que le pase
 * quien la lance —incluido el `message` de un SDK—. Lo mismo con
 * `AiProviderError`, que puede citar al proveedor, y con
 * `ForbiddenAddressError` / `SafeFetchInternalError`, que citan hostnames y
 * direcciones internas. Ninguna entra.
 *
 * `SafeUserError` es la única aquí porque su contrato es justamente ese: el
 * mensaje lo redactamos nosotros, literal, y existe para poder distinguirlo en
 * runtime de un `new Error(...)` cualquiera.
 */
import { SafeUserError } from "@/lib/ai/errors";

/**
 * Lo mínimo que puede cruzar hacia fuera: una etiqueta estable y un texto que
 * ya era nuestro antes de llegar aquí.
 */
export type PublicFailure = {
  /** Código estable, para que el consumidor discrimine sin parsear texto. */
  code: string;
  /** Mensaje redactado por nosotros. Jamás el `message` de un desconocido. */
  message: string;
};

/**
 * Traduce cualquier excepción a una `PublicFailure`.
 *
 * `fallback` es la respuesta para todo lo que no esté demostrado como seguro, y
 * es lo que se emite en el caso dominante. Conviene que sea específico de la
 * operación ("No se pudo sellar el artefacto") en vez de genérico: es el único
 * texto que el usuario va a ver.
 *
 * No registra nada por su cuenta: quien llama decide qué loguear y con qué
 * nivel. Y no devuelve el error original en el resultado —ni siquiera bajo otra
 * clave—, porque cualquier consumidor que lo serialice reintroduciría la fuga.
 */
export function toPublicFailure(error: unknown, fallback: PublicFailure): PublicFailure {
  // Mensaje literal nuestro por construcción. Es la única clase cuya seguridad
  // es explícita y parte de su contrato.
  if (error instanceof SafeUserError) {
    return { code: error.code, message: error.message };
  }

  // Desconocido. No se inspecciona de ninguna forma.
  return fallback;
}
