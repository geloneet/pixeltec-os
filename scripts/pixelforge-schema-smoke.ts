/**
 * Smoke de compilación de schemas — PixelForge F2-T7 (Gate 0, condición 1).
 *
 * Qué hace: para cada una de las 11 operaciones IA de PixelForge, dispara una
 * llamada MÍNIMA real a `client.messages.parse` con el `output_config.format`
 * de esa operación (vía `zodOutputFormat`, igual que `ai/run.ts`) y
 * `max_tokens: 64`. El objetivo NO es generar una salida completa — es forzar
 * al servidor de Anthropic a COMPILAR la grammar de Structured Outputs a
 * partir del schema Zod antes de generar un solo token. Esa compilación
 * ocurre server-side, previa a cualquier generación: si el schema es
 * demasiado complejo para compilarse como grammar, la API devuelve un 400
 * cuyo mensaje menciona schema/grammar/output_config/format ANTES de emitir
 * texto — no hace falta dejar completar la respuesta para detectarlo. Por
 * eso `max_tokens: 64` alcanza (y ahorra tokens/dinero frente al `maxTokens`
 * real de cada operación, que llega a 16000 en `compose_page_tree`): solo
 * queremos ver si la compilación de la grammar tronó o no.
 *
 * Resultado por operación:
 *   - Respuesta normal, O stop_reason "max_tokens", O parsed_output null
 *     ⇒ "OK (compiló)" — la grammar se aceptó; que la respuesta se haya
 *     cortado por max_tokens o no haya alcanzado a parsear un objeto
 *     completo en 64 tokens es esperado y NO es una falla de compilación.
 *   - `messages.parse()` LANZA (no devuelve `stop_reason: "max_tokens"`)
 *     cuando la respuesta truncada por `max_tokens` deja JSON incompleto:
 *     el SDK intenta `JSON.parse` client-side sobre el texto truncado
 *     ANTES de exponer `stop_reason`, y esa excepción es una
 *     `AnthropicError` (no `APIError`) con mensaje
 *     `"Failed to parse structured output as JSON: Unterminated string..."`
 *     (ver `helpers/zod.js`/`lib/parser.js` del SDK). Esto NO prueba que la
 *     grammar falló — al revés: la API respondió 200 y generó tokens
 *     restringidos por el schema, lo cual solo es posible si la grammar
 *     compiló. Por eso este mensaje se detecta ANTES del check de
 *     `APIError` (más abajo) y también cuenta como ⇒ "OK (compiló — salida
 *     truncada por max_tokens)".
 *   - APIError con status 400 y mensaje que matchea /schema|grammar|
 *     output_config|format/i ⇒ "FALLA schema_too_complex" — la MISMA regla
 *     de clasificación que usa `ai/failures.ts` (`classifyError`), para que
 *     este script y el motor de runs coincidan en qué cuenta como fallo de
 *     compilación de schema.
 *   - Cualquier otro error (red, 401, 429, 5xx, timeout...) ⇒ "ERROR" — se
 *     reporta pero NO cuenta como fallo de compilación: no sabemos si la
 *     grammar hubiera compilado, solo que la llamada no llegó a buen puerto
 *     por otra causa.
 *
 * Uso (requiere ANTHROPIC_API_KEY real — dispara 11 llamadas reales, gastan
 * tokens; NO se corre en `npm test` ni en CI, lo ejecuta el controlador del
 * plan a mano al cerrar la fase F2):
 *
 *   export $(grep -E '^(ANTHROPIC_API_KEY|DATABASE_URL)=' .env .env.local | sed 's/^[^:]*://') && npx tsx scripts/pixelforge-schema-smoke.ts
 *
 * (DATABASE_URL no lo usa este script — se incluye en el `export` porque es
 * el patrón estándar del repo para cargar `.env`+`.env.local` a mano; no
 * hace daño tenerlo en el entorno del proceso.)
 *
 * Nota sobre imports: a diferencia de `scripts/seed.ts` (que usa imports
 * relativos), acá se usa el alias `@/` — se verificó a mano que `tsx`
 * resuelve el `paths` de `tsconfig.json` cuando el comando corre desde la
 * raíz del repo (mismo alias que usa el resto de `src/`), así que no hizo
 * falta caer al relativo.
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod/v4";
import { getPixelforgeAnthropic, resolvePixelForgeModel } from "@/lib/pixelforge/ai/client";
import { OPERATION_SPECS, PIXELFORGE_AI_OPERATIONS, type PixelforgeAIOperation } from "@/lib/pixelforge/schemas";

const SCHEMA_ISSUE_PATTERN = /schema|grammar|output_config|format/i;
/** Ver comentario de cabecera: `messages.parse()` lanza esto client-side cuando `max_tokens` corta el JSON a mitad de camino — es la prueba de que la grammar SÍ compiló (llegó a generar tokens restringidos), no un fallo. */
const TRUNCATED_PARSE_PATTERN = /Failed to parse structured output/i;
const SMOKE_MAX_TOKENS = 64;

type Resultado = "OK" | "FALLA" | "ERROR";

interface FilaResultado {
  operacion: PixelforgeAIOperation;
  resultado: Resultado;
  detalle: string;
  stopReason: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  ms: number;
}

/**
 * Mismo cast que `buildOutputFormat` en `ai/run.ts`: el `.d.ts` publicado del
 * SDK tipa el parámetro contra el `ZodType` de `"zod"` v3 clásico, pero en
 * runtime `zodOutputFormat` opera sobre `zod/v4` real — que es justo lo que
 * traen los `outputSchema` de `OPERATION_SPECS`.
 */
function buildOutputFormat(schema: z.ZodTypeAny): ReturnType<typeof zodOutputFormat> {
  return zodOutputFormat(schema as unknown as Parameters<typeof zodOutputFormat>[0]);
}

interface ParseResponse {
  stop_reason: string | null;
  parsed_output: unknown;
  usage: { input_tokens: number; output_tokens: number };
}

async function smokeOne(client: Anthropic, operation: PixelforgeAIOperation): Promise<FilaResultado> {
  const spec = OPERATION_SPECS[operation];
  const model = resolvePixelForgeModel(operation);
  const startedAt = Date.now();

  try {
    const response = (await client.messages.parse({
      model,
      max_tokens: SMOKE_MAX_TOKENS,
      system: "Responde el objeto pedido.",
      messages: [{ role: "user", content: "Genera un ejemplo mínimo." }],
      output_config: { format: buildOutputFormat(spec.outputSchema) },
    })) as unknown as ParseResponse;

    return {
      operacion: operation,
      resultado: "OK",
      detalle: "compiló",
      stopReason: response.stop_reason,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      ms: Date.now() - startedAt,
    };
  } catch (err) {
    const ms = Date.now() - startedAt;
    const rawMessage = err instanceof Error ? err.message : String(err);

    // Debe ir ANTES del check de APIError: esta excepción es client-side
    // (JSON.parse post-generación sobre una respuesta truncada por
    // max_tokens), no un rechazo del servidor — ver comentario de cabecera.
    if (TRUNCATED_PARSE_PATTERN.test(rawMessage)) {
      return {
        operacion: operation,
        resultado: "OK",
        detalle: "compiló — salida truncada por max_tokens (JSON.parse client-side falló sobre la respuesta incompleta, no la API)",
        stopReason: "max_tokens (inferido — el SDK lanza antes de exponerlo)",
        tokensIn: null,
        tokensOut: null,
        ms,
      };
    }

    if (err instanceof Anthropic.APIError) {
      const status = err.status;
      const message = err.message ?? "";
      if (status === 400 && SCHEMA_ISSUE_PATTERN.test(message)) {
        return {
          operacion: operation,
          resultado: "FALLA",
          detalle: `schema_too_complex: ${message}`,
          stopReason: null,
          tokensIn: null,
          tokensOut: null,
          ms,
        };
      }
      return {
        operacion: operation,
        resultado: "ERROR",
        detalle: `HTTP ${status ?? "?"}: ${message} (no prueba fallo de compilación — otra causa)`,
        stopReason: null,
        tokensIn: null,
        tokensOut: null,
        ms,
      };
    }

    return {
      operacion: operation,
      resultado: "ERROR",
      detalle: `${rawMessage} (no prueba fallo de compilación — otra causa)`,
      stopReason: null,
      tokensIn: null,
      tokensOut: null,
      ms,
    };
  }
}

function etiquetaResultado(resultado: Resultado): string {
  if (resultado === "OK") return "OK (compiló)";
  if (resultado === "FALLA") return "FALLA schema_too_complex";
  return "ERROR";
}

function printTable(filas: FilaResultado[]): void {
  const headers = ["operación", "resultado", "stop_reason", "tokens in/out", "ms", "detalle"];
  const rows = filas.map((f) => [
    f.operacion,
    etiquetaResultado(f.resultado),
    f.stopReason ?? "-",
    f.tokensIn !== null ? `${f.tokensIn}/${f.tokensOut}` : "-",
    String(f.ms),
    f.detalle,
  ]);
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const printRow = (cells: string[]): void => console.log(cells.map((c, i) => c.padEnd(widths[i])).join("  "));

  printRow(headers);
  printRow(widths.map((w) => "-".repeat(w)));
  rows.forEach(printRow);
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "❌ ANTHROPIC_API_KEY no está configurada.\n" +
        "   Este script hace 11 llamadas REALES a la API de Anthropic para verificar\n" +
        "   que las grammars de Structured Outputs de PixelForge compilan. Corré:\n\n" +
        "   export $(grep -E '^(ANTHROPIC_API_KEY|DATABASE_URL)=' .env .env.local | sed 's/^[^:]*://') && npx tsx scripts/pixelforge-schema-smoke.ts\n"
    );
    process.exit(1);
    return;
  }

  const client = getPixelforgeAnthropic();
  const filas: FilaResultado[] = [];

  console.log(
    `Verificando compilación de ${PIXELFORGE_AI_OPERATIONS.length} schemas de PixelForge contra la API real de Anthropic (max_tokens=${SMOKE_MAX_TOKENS} c/u)...\n`
  );

  // Secuencial a propósito, NO en paralelo: son 11 llamadas reales y un
  // Promise.all las mandaría todas de golpe contra el rate limit por minuto.
  for (const operation of PIXELFORGE_AI_OPERATIONS) {
    process.stdout.write(`  ${operation}... `);
    const fila = await smokeOne(client, operation);
    console.log(etiquetaResultado(fila.resultado));
    filas.push(fila);
  }

  console.log("");
  printTable(filas);

  const fallas = filas.filter((f) => f.resultado === "FALLA");
  const errores = filas.filter((f) => f.resultado === "ERROR");
  const oks = filas.filter((f) => f.resultado === "OK");

  console.log(
    `\nTotales: ${oks.length} OK / ${fallas.length} FALLA (schema_too_complex) / ${errores.length} ERROR (otra causa) de ${filas.length} operaciones.`
  );

  if (errores.length > 0) {
    console.warn(
      `\n⚠️  ${errores.length} operación(es) tuvieron un error que NO prueba fallo de compilación (red, auth, rate limit...). Revisar el detalle en la tabla.`
    );
  }

  if (fallas.length > 0) {
    console.error(`\n❌ ${fallas.length} schema(s) NO compilaron como grammar de Structured Outputs.`);
    process.exit(1);
    return;
  }

  if (errores.length > 0) {
    console.log(
      `\n◯ Sin fallos de compilación detectados, pero ${errores.length} operación(es) no fueron concluyentes (ver detalle arriba).`
    );
  } else {
    console.log(`\n✅ Los ${filas.length} schemas compilaron como grammars de Structured Outputs.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error inesperado en el smoke de schemas:", err);
  process.exit(1);
});
