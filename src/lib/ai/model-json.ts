/**
 * Extrae y parsea el bloque JSON de una respuesta del modelo, sin filtrar su
 * contenido en el error.
 *
 * Motivo: V8 incrusta un fragmento de la entrada en el `SyntaxError` de
 * `JSON.parse` —`Unexpected token 'e', "esto no es"... is not valid JSON`—, así
 * que un `console.error(err)` en el catch de una ruta acaba escribiendo en los
 * logs parte de la respuesta del modelo, que puede citar datos del cliente. El
 * fallo hay que reportarlo; el texto, no.
 *
 * Mismo criterio que `src/lib/pixelforge/ai/run.ts`, que ya parsea a mano y
 * devuelve un mensaje fijo en vez del error del parser.
 */

/** Error de forma de la respuesta. Deliberadamente sin fragmentos del texto. */
export class ModelResponseFormatError extends Error {
  readonly code = "MODEL_RESPONSE_FORMAT" as const;

  constructor(reason: "no_json_block" | "invalid_json") {
    super(`MODEL_RESPONSE_FORMAT: ${reason}`);
    this.name = "ModelResponseFormatError";
    Object.setPrototypeOf(this, ModelResponseFormatError.prototype);
  }
}

/**
 * Busca el primer bloque `{...}` del texto y lo parsea. Lanza
 * {@link ModelResponseFormatError} si no hay bloque o si no es JSON válido.
 */
export function parseModelJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new ModelResponseFormatError("no_json_block");

  try {
    return JSON.parse(match[0]) as T;
  } catch {
    throw new ModelResponseFormatError("invalid_json");
  }
}
