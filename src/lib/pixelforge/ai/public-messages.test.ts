import { describe, expect, test } from "vitest";

/**
 * Saneamiento EN LECTURA de `pixelforgeAiRuns.error` (E0f-3b).
 *
 * `getRunForOwner` pasa la columna por este sanitizador antes de servir el
 * shape público al poller: las corridas históricas persistieron el `message`
 * crudo del SDK o el texto de Zod, y la fila no se muta (limpieza física =
 * gate posterior al snapshot). El poller y los toasts siguen recibiendo
 * siempre una cadena user-facing.
 */
import { RUN_PUBLIC_MESSAGES, sanitizeRunErrorForPublic } from "./public-messages";

const TOKEN_PRIVADO = "sk-ant-api03-tokenprivadodeanthropic";
const PROVIDER_BODY = '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}';
const ZOD_CON_SALIDA_DEL_MODELO = '- confirmados.0.titulo: Invalid enum value. Received "Cliente Confidencial SA de CV"';

describe("sanitizeRunErrorForPublic", () => {
  test("texto histórico crudo se reemplaza por el mensaje público de provider_error", () => {
    for (const heredado of [TOKEN_PRIVADO, PROVIDER_BODY, ZOD_CON_SALIDA_DEL_MODELO]) {
      expect(sanitizeRunErrorForPublic(heredado)).toBe(RUN_PUBLIC_MESSAGES.provider_error);
    }
  });

  test("los mensajes públicos propios se conservan literales", () => {
    for (const mensaje of Object.values(RUN_PUBLIC_MESSAGES)) {
      expect(sanitizeRunErrorForPublic(mensaje)).toBe(mensaje);
    }
  });

  test("los literales legítimos previos (route y guards de advisory) se conservan", () => {
    for (const literal of [
      "Error inesperado",
      "No hay un QA en curso para este proyecto",
      "La crítica de diseño IA ya se lanzó para este QA",
    ]) {
      expect(sanitizeRunErrorForPublic(literal)).toBe(literal);
    }
  });

  test("null (corrida exitosa o en curso) permanece null", () => {
    expect(sanitizeRunErrorForPublic(null)).toBeNull();
  });
});
