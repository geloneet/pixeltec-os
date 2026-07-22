/**
 * `attachNetworkCollector` — engancha los listeners de una `Page` de
 * Playwright ANTES de navegar (QA-TE-001..004/006, T6): errores de runtime,
 * console.error, requests fallidas/≥400 y bytes transferidos por tipo. Un
 * único punto de wiring para que `run-job.ts` no repita `page.on(...)` en
 * cada pasada — se llama una vez por `page` recién creada.
 *
 * `resourceBytes` acumula por `resourceType` ("image" | "script" | resto) —
 * solo esas 2 cubetas hacen falta para QA-TE-006 (`IMAGE_ASSET_SIZE_BUDGET_BYTES`
 * / `JS_SIZE_BUDGET_BYTES`, `qa/catalog.ts`).
 */
import type { Page, Request } from "playwright";
import { originOf } from "./security";

export interface CollectedRequestFailure {
  url: string;
  sameOrigin: boolean;
  detail: string;
}

export interface NetworkCollector {
  pageErrors: string[];
  consoleErrors: string[];
  requestFailures: CollectedRequestFailure[];
  imageBytes: number;
  jsBytes: number;
}

function isSameOrigin(url: string, allowedOrigin: string): boolean {
  return originOf(url) === allowedOrigin;
}

export function attachNetworkCollector(page: Page, allowedOrigin: string): NetworkCollector {
  const collector: NetworkCollector = {
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    imageBytes: 0,
    jsBytes: 0,
  };

  page.on("pageerror", (err) => {
    collector.pageErrors.push(err instanceof Error ? err.message : String(err));
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") collector.consoleErrors.push(msg.text());
  });

  page.on("requestfailed", (request: Request) => {
    const failure = request.failure();
    collector.requestFailures.push({
      url: request.url(),
      sameOrigin: isSameOrigin(request.url(), allowedOrigin),
      detail: failure?.errorText ?? "request failed",
    });
  });

  page.on("response", (response) => {
    const request = response.request();
    if (response.status() >= 400) {
      collector.requestFailures.push({
        url: request.url(),
        sameOrigin: isSameOrigin(request.url(), allowedOrigin),
        detail: `HTTP ${response.status()}`,
      });
    }
    response
      .body()
      .then((body) => {
        const resourceType = request.resourceType();
        if (resourceType === "image") collector.imageBytes += body.length;
        else if (resourceType === "script") collector.jsBytes += body.length;
      })
      .catch(() => {
        // Recursos que Playwright no puede leer (redirect ya consumido,
        // stream de datos, etc.) — no cuentan para el presupuesto, mejor
        // subestimar que tumbar el listener.
      });
  });

  return collector;
}
