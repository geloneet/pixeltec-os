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
 * Uso local:
 *   npx playwright install chromium   (una sola vez)
 *   npx tsx scripts/qa-runner/selftest.ts
 *
 * Exit 0 si los 9 fixtures cumplen su expectativa; exit 1 si alguno falla
 * (imprime el detalle de qué código faltó o sobró).
 */
import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { attachNetworkCollector } from "./collectors";
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

async function main(): Promise<void> {
  const { server, origin } = await startStaticServer();
  const browser = await chromium.launch();

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
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  if (failedCount > 0) {
    console.error(`\nSELFTEST FALLÓ: ${failedCount}/${FIXTURES.length} fixture(s) no cumplieron su expectativa.`);
    process.exit(1);
  }
  console.log(`\nSELFTEST OK: ${FIXTURES.length}/${FIXTURES.length} fixtures cumplieron su expectativa.`);
}

main().catch((err) => {
  console.error("[selftest] error fatal:", err);
  process.exit(1);
});
