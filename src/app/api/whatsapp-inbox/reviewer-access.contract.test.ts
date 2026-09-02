import { describe, expect, test } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { REVIEWER_API_ALLOWLIST } from "@/lib/routes/reviewer-access";

/**
 * CONTRATO a nivel de fuente (WO-2026-00051): la allowlist del middleware y
 * el guard de cada handler de /api/whatsapp-inbox deben coincidir.
 *
 * - Handler en la allowlist ⇒ usa `requireWhatsAppReviewAccess` (admin ∨ reviewer).
 * - Handler fuera de la allowlist ⇒ conserva `requireAdmin` (reviewer → 403).
 * - Todo handler exportado tiene exactamente UN guard, y ninguno queda sin él.
 *
 * Un test de runtime pasaría igual si alguien pusiera el guard flojo en una
 * ruta excluida; por eso el contrato se verifica leyendo la fuente.
 */

const ROOT = resolve(__dirname);

/** Allowlist expresada como `MÉTODO ruta-de-archivo` (ruta relativa a este dir). */
const ALLOWLIST_FILES: Record<string, string> = {
  "GET /conversations": "conversations/route.ts",
  "GET /conversations/[phone]/messages": "conversations/[phone]/messages/route.ts",
  "POST /conversations/read": "conversations/read/route.ts",
  "POST /send": "send/route.ts",
  "POST /mode": "mode/route.ts",
  "GET /coexistence/status": "coexistence/status/route.ts",
  "GET /contacts": "contacts/route.ts",
  "GET /contacts/[phone]/notes": "contacts/[phone]/notes/route.ts",
  "GET /memory": "memory/route.ts",
  "GET /config": "config/route.ts",
  "GET /config/versions": "config/versions/route.ts",
  "GET /examples": "examples/route.ts",
  "POST /simulate": "simulate/route.ts",
  // WO-2026-00181 — gestión de la cuenta (whatsapp_business_management).
  "GET /account": "account/route.ts",
  "GET /templates": "templates/route.ts",
  "POST /templates": "templates/route.ts",
};

/**
 * Rutas de la allowlist cuyo handler AÚN no existe en esta rama (viven en
 * otra rama sin mergear). El middleware ya las permite; cuando el archivo
 * aparezca, este contrato obliga a ponerle el guard correcto.
 */
const PENDING_ROUTES = new Set(["GET /coexistence/status"]); // WO-2026-00047

function walkRoutes(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkRoutes(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

/** Extrae `{ método → guard }` de un route.ts leyendo cada handler exportado. */
function guardsByHandler(file: string): Record<string, string[]> {
  const src = readFileSync(file, "utf8");
  const out: Record<string, string[]> = {};
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;
  const starts: Array<{ method: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) starts.push({ method: m[1], index: m.index });
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    const body = src.slice(s.index, end);
    out[s.method] = [...body.matchAll(/await (requireAdmin|requireWhatsAppReviewAccess)\(/g)].map(
      (x) => x[1]
    );
  });
  return out;
}

describe("contrato allowlist reviewer ↔ guards de /api/whatsapp-inbox", () => {
  test("la allowlist del middleware y la tabla de archivos de este test coinciden", () => {
    expect(REVIEWER_API_ALLOWLIST.map((r) => r.label).sort()).toEqual(
      Object.keys(ALLOWLIST_FILES).sort()
    );
  });

  test("cada handler de la allowlist usa requireWhatsAppReviewAccess (o está declarado pendiente)", () => {
    for (const [label, rel] of Object.entries(ALLOWLIST_FILES)) {
      const [method] = label.split(" ");
      const file = join(ROOT, rel);
      if (!existsSync(file)) {
        expect(PENDING_ROUTES.has(label), `${label}: el archivo no existe y no está en PENDING_ROUTES`).toBe(true);
        continue;
      }
      expect(PENDING_ROUTES.has(label), `${label}: ya existe — quítalo de PENDING_ROUTES`).toBe(false);
      const guards = guardsByHandler(file);
      expect(guards[method], `${label}: handler ${method} no encontrado`).toEqual([
        "requireWhatsAppReviewAccess",
      ]);
    }
  });

  test("todo handler FUERA de la allowlist conserva requireAdmin, y ninguno queda sin guard", () => {
    const allowed = new Set(
      Object.entries(ALLOWLIST_FILES).map(([label, rel]) => `${label.split(" ")[0]} ${rel}`)
    );
    const seen: string[] = [];
    for (const file of walkRoutes(ROOT)) {
      const rel = file.slice(ROOT.length + 1);
      for (const [method, guards] of Object.entries(guardsByHandler(file))) {
        const key = `${method} ${rel}`;
        seen.push(key);
        if (allowed.has(key)) continue;
        expect(guards, `${key} debe usar exactamente requireAdmin`).toEqual(["requireAdmin"]);
      }
    }
    // 24 handlers tras WO-2026-00181 (25 cuando aterrice coexistence/status).
    expect(seen.length).toBeGreaterThanOrEqual(24);
    const excluded = seen.filter((k) => !allowed.has(k));
    expect(excluded.sort()).toEqual(
      [
        "PUT config/route.ts",
        "POST config/draft/route.ts",
        "POST config/publish/route.ts",
        "POST config/rollback/route.ts",
        "POST contacts/route.ts",
        "POST contacts/[phone]/notes/route.ts",
        "POST tickets/route.ts",
        "POST examples/route.ts",
        "POST examples/[id]/active/route.ts",
      ].sort()
    );
  });
});
