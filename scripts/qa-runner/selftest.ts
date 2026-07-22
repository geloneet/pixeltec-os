#!/usr/bin/env node
/**
 * Selftest del qa-runner (PF-F8 T6) — gate de ESTA tarea, FUERA de `npm test`
 * (no corre en CI/vitest: levanta un Chromium real). Verifica, contra
 * fixtures HTML rotas A PROPÓSITO (mismos `data-pf-*` que el preview real),
 * que cada check dispara EXACTAMENTE cuando debe y NO cuando no debe —
 * "check esperado dispara / demás no", con una lista explícita (y
 * documentada abajo) de colaterales permitidos por fixture.
 *
 * Checks bajo prueba (8 códigos, uno por fixture + 1 control sano):
 *   QA-VI-001 (overflow.html), QA-VI-005 (broken-image.html), QA-AX-001
 *   (contrast.html, vía axe color-contrast), QA-TE-001 (throw.html),
 *   QA-TE-002 (hydration.html), QA-MO-001 (motion-stuck.html), QA-AX-002
 *   (focus-trap.html), QA-MO-003 (count-frozen.html), control.html (ninguno).
 *
 * Además (fuera de la lista FIXTURES, gate propio — review PF-F8 T6, req. 14
 * "cero egress"): `websocket-egress.html` abre un `new WebSocket(...)` hacia
 * un host EXTERNO al origin del fixture server. Con los 2 gates instalados
 * (`installEgressAllowlist` + `installWebSocketBlock`, `route-guard.ts`) el
 * WebSocket debe quedar bloqueado (mockeado y cerrado, cero conexión TCP
 * real) Y el intento debe quedar registrado como bloqueado — sin que eso
 * afecte a los demás checks corridos sobre la MISMA página (deben comportarse
 * como control.html: ningún código de la lista bajo prueba dispara).
 *
 * Uso local:
 *   npx playwright install chromium   (una sola vez)
 *   npx tsx scripts/qa-runner/selftest.ts
 *
 * Exit 0 si los 9 fixtures + el check de WebSocket cumplen su expectativa;
 * exit 1 si alguno falla (imprime el detalle de qué código faltó o sobró).
 */
import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { attachNetworkCollector } from "./collectors";
import { installEgressAllowlist, installWebSocketBlock, type BlockedRequestEvent } from "./route-guard";
import { checkDocumentOverflow, checkBrokenImages } from "./checks/visual";
import { checkAxeViolations, checkKeyboardTrap } from "./checks/axe";
import { checkPageErrorsAndHydration } from "./checks/technical";
import { scrollThroughSections, checkMotionDeadlock, checkCountUpSettled } from "./checks/motion";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const PORT = 5799;
const VIEWPORT = { width: 390, height: 844 };

interface FixtureSpec {
  file: string;
  expectedCode: string | null; // null = fixture de control, sin findings esperados.
  /** Códigos de la lista bajo prueba que SÍ pueden acompañar al esperado (documentados, no un catch-all). */
  allowedCollateral?: string[];
}

const FIXTURES: FixtureSpec[] = [
  { file: "overflow.html", expectedCode: "QA-VI-001" },
  { file: "broken-image.html", expectedCode: "QA-VI-005" },
  { file: "contrast.html", expectedCode: "QA-AX-001" },
  { file: "throw.html", expectedCode: "QA-TE-001" },
  { file: "hydration.html", expectedCode: "QA-TE-002" },
  { file: "motion-stuck.html", expectedCode: "QA-MO-001" },
  { file: "focus-trap.html", expectedCode: "QA-AX-002" },
  { file: "count-frozen.html", expectedCode: "QA-MO-003" },
  { file: "control.html", expectedCode: null },
];

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
};

function startStaticServer(): Promise<{ server: http.Server; origin: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url ?? "/").split("?")[0];
      const filePath = path.join(FIXTURES_DIR, decodeURIComponent(urlPath));
      // Confinamiento defensivo: nunca servir fuera de FIXTURES_DIR (aunque
      // este servidor solo escucha en 127.0.0.1 para el selftest local).
      if (!filePath.startsWith(FIXTURES_DIR) || !existsSync(filePath)) {
        res.writeHead(404).end("not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve({ server, origin: `http://127.0.0.1:${PORT}` }));
  });
}

/** Corre los 8 checks bajo prueba contra UN fixture y devuelve el set de códigos que dispararon. */
async function runChecksAgainstFixture(browser: Browser, origin: string, file: string): Promise<Set<string>> {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const collector = attachNetworkCollector(page, origin);

  await page.goto(`${origin}/${file}`, { waitUntil: "load", timeout: 15_000 });
  await page.waitForTimeout(300);

  const codes = new Set<string>();
  const record = (findings: { checkCode: string }[]) => findings.forEach((f) => codes.add(f.checkCode));

  record(await checkDocumentOverflow(page, "mobile"));
  record(await checkBrokenImages(page, "mobile"));
  record(await checkAxeViolations(page, "mobile"));
  record(checkPageErrorsAndHydration(collector, "mobile"));
  await scrollThroughSections(page);
  record(await checkMotionDeadlock(page, "mobile"));
  record(await checkCountUpSettled(page, "mobile"));
  record(await checkKeyboardTrap(page, "mobile"));

  await context.close();
  return codes;
}

/**
 * Gate dedicado del review PF-F8 T6 (req. 14, "cero egress"): abre
 * `websocket-egress.html` (un `new WebSocket('ws://127.0.0.1:1/')` — host
 * EXTERNO al origin del fixture server) con `installEgressAllowlist` +
 * `installWebSocketBlock` instalados, igual que `run-job.ts`. Verifica 3
 * cosas: (1) el WebSocket del navegador NUNCA reporta `open` (si el gate
 * fallara, el intento de conexión real al puerto 1 tardaría o abriría); (2)
 * el intento queda registrado como bloqueado (mismo canal que
 * `NetworkCollector.requestFailures`, que alimenta QA-TE-003); (3) los demás
 * checks sobre la MISMA página no se ven afectados — deben comportarse como
 * `control.html` (ningún código de la lista bajo prueba dispara).
 */
async function runWebSocketEgressFixture(browser: Browser, origin: string): Promise<{ ok: boolean; detail: string }> {
  const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: "block" });
  const page = await context.newPage();
  const collector = attachNetworkCollector(page, origin);
  const blocked: BlockedRequestEvent[] = [];

  await installEgressAllowlist(page, origin);
  await installWebSocketBlock(page, (event) => {
    blocked.push(event);
    collector.requestFailures.push({
      url: event.url,
      sameOrigin: false,
      detail: `WebSocket bloqueado por política de egress (${event.reason})`,
    });
  });

  await page.goto(`${origin}/websocket-egress.html`, { waitUntil: "load", timeout: 15_000 });
  await page.waitForTimeout(300);

  const wsClosed = await page.evaluate(
    () => (window as unknown as { __pfWsClosed?: boolean }).__pfWsClosed === true
  );
  const wsOpened = await page.evaluate(
    () => (window as unknown as { __pfWsOpened?: boolean }).__pfWsOpened === true
  );

  const codes = new Set<string>();
  const record = (findings: { checkCode: string }[]) => findings.forEach((f) => codes.add(f.checkCode));
  record(await checkDocumentOverflow(page, "mobile"));
  record(await checkBrokenImages(page, "mobile"));
  record(await checkAxeViolations(page, "mobile"));
  record(checkPageErrorsAndHydration(collector, "mobile"));
  await scrollThroughSections(page);
  record(await checkMotionDeadlock(page, "mobile"));
  record(await checkCountUpSettled(page, "mobile"));
  record(await checkKeyboardTrap(page, "mobile"));

  await context.close();

  const problems: string[] = [];
  if (wsOpened) problems.push("el WebSocket llegó a reportar 'open' — el gate no lo bloqueó");
  if (!wsClosed) problems.push("el WebSocket nunca reportó close/constructor-throw — sin evidencia de bloqueo");
  if (blocked.length !== 1) {
    problems.push(`se esperaba exactamente 1 intento de WebSocket bloqueado registrado, hubo ${blocked.length}`);
  }
  if (blocked.length > 0 && blocked[0].reason !== "websocket-blocked-all") {
    problems.push(`reason inesperado: ${blocked[0].reason}`);
  }
  for (const code of codes) {
    problems.push(`disparó ${code} inesperadamente (el gate de WebSocket no debe afectar a los demás checks)`);
  }

  const ok = problems.length === 0;
  return {
    ok,
    detail:
      `websocket-egress.html — wsClosed=${wsClosed} wsOpened=${wsOpened} ` +
      `intentosBloqueados=${blocked.length} códigos=[${[...codes].join(", ") || "ninguno"}]` +
      `${problems.length ? " — " + problems.join("; ") : ""}`,
  };
}

async function main(): Promise<void> {
  const { server, origin } = await startStaticServer();
  const browser = await chromium.launch();

  const total = FIXTURES.length + 1;
  let failedCount = 0;
  try {
    for (const fixture of FIXTURES) {
      const codes = await runChecksAgainstFixture(browser, origin, fixture.file);
      const allowed = new Set<string>([
        ...(fixture.expectedCode ? [fixture.expectedCode] : []),
        ...(fixture.allowedCollateral ?? []),
      ]);

      const problems: string[] = [];
      if (fixture.expectedCode && !codes.has(fixture.expectedCode)) {
        problems.push(`esperado ${fixture.expectedCode} NO disparó`);
      }
      for (const code of codes) {
        if (!allowed.has(code)) problems.push(`disparó ${code} inesperadamente`);
      }

      const ok = problems.length === 0;
      if (!ok) failedCount++;
      console.log(
        `${ok ? "✅" : "❌"} ${fixture.file} — códigos observados: [${[...codes].join(", ") || "ninguno"}]${
          problems.length ? " — " + problems.join("; ") : ""
        }`
      );
    }

    const wsResult = await runWebSocketEgressFixture(browser, origin);
    if (!wsResult.ok) failedCount++;
    console.log(`${wsResult.ok ? "✅" : "❌"} ${wsResult.detail}`);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  if (failedCount > 0) {
    console.error(`\nSELFTEST FALLÓ: ${failedCount}/${total} fixture(s) no cumplieron su expectativa.`);
    process.exit(1);
  }
  console.log(`\nSELFTEST OK: ${total}/${total} fixtures cumplieron su expectativa.`);
}

main().catch((err) => {
  console.error("[selftest] error fatal:", err);
  process.exit(1);
});
