/**
 * Verificación del repo de REVISIÓN de PixelForge — PF-F9 T3 (capa
 * transaccional: locks, CAS, carreras, atomicidad). Es la evidencia dura que
 * vitest puro NO puede dar: no hay infra de tests contra DB real en este repo.
 *
 * Qué hace: levanta un Postgres 16 DESECHABLE vía Docker (puerto 5498,
 * contenedor `pf-f9-t3-db` — NUNCA toca la DB de dev/prod 5437), aplica TODAS
 * las migraciones (`./drizzle`, 0000–0026) con el migrador de
 * `drizzle-orm/postgres-js`, siembra fixtures mínimos y ejercita el repo
 * (`src/lib/db/repos/pixelforge.ts`) contra la DB real. 15 checks numerados
 * con evidencia impresa.
 *
 * Trampa de imports (igual que pixelforge-qa-repo-verify.ts): `@/lib/db` es un
 * singleton que fija `DATABASE_URL` al importar el MÓDULO. Por eso `@/lib/db`,
 * `@/lib/db/schema` y el repo se importan con `import()` DINÁMICO recién tras
 * apuntar `process.env.DATABASE_URL` al desechable. Los `import type` de la
 * cabecera se borran en compilación (no ejecutan nada).
 *
 * Uso (requiere Docker; arma su propia DATABASE_URL efímera):
 *   ./node_modules/.bin/tsx scripts/pixelforge-review-repo-verify.ts
 *
 * Se destruye el contenedor al terminar (éxito o error) — `finally` +
 * handler de error, ambos con `docker rm -f`.
 */
import { execSync } from "node:child_process";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type * as SchemaModule from "@/lib/db/schema";
import type * as PixelforgeRepoModule from "@/lib/db/repos/pixelforge";

const CONTAINER_NAME = "pf-f9-t3-db";
const PORT = 5498;
const DB_URL = `postgres://verify:verify@127.0.0.1:${PORT}/verify`;

interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

const results: CheckResult[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function startDisposablePostgres(): void {
  console.log(`Levantando Postgres desechable (${CONTAINER_NAME}, puerto ${PORT})...`);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  execSync(
    `docker run --rm -d --name ${CONTAINER_NAME} ` +
      `-e POSTGRES_USER=verify -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=verify ` +
      `-p 127.0.0.1:${PORT}:5432 postgres:16-alpine`,
    { stdio: "inherit" }
  );
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    const probe = postgres(DB_URL, { max: 1 });
    try {
      await probe.unsafe("select 1");
      await probe.end();
      return;
    } catch (err) {
      lastErr = err;
      await probe.end({ timeout: 1 }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Postgres desechable no respondió a tiempo: ${String(lastErr)}`);
}

async function applyMigrations(): Promise<void> {
  console.log("Aplicando migraciones 0000-0026 (drizzle-orm/postgres-js migrator)...");
  const migrationClient = postgres(DB_URL, { max: 1 });
  const migrationDb = drizzle(migrationClient);
  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  await migrationClient.end();
}

async function main(): Promise<void> {
  startDisposablePostgres();
  try {
    await waitForPostgres();
    await applyMigrations();

    process.env.DATABASE_URL = DB_URL;
    const schema = (await import("@/lib/db/schema")) as typeof SchemaModule;
    const { db } = await import("@/lib/db");
    const repo = (await import("@/lib/db/repos/pixelforge")) as typeof PixelforgeRepoModule;
    const { isReleaseReady } = await import("@/lib/pixelforge/review/stage");
    const { eq, and, desc } = await import("drizzle-orm");

    interface Fixture {
      ownerId: string;
      projectId: string;
      pageVersionId: string;
      version: number;
      actor: { id: string; name: string };
    }

    const REAL_TREE = {
      nodes: [
        { nodeId: "hero-1", componentId: "hero-split", variant: "media-right", orden: 1, propsJson: "{}" },
        { nodeId: "features-1", componentId: "feature-grid", variant: "3-col", orden: 2, propsJson: "{}" },
        { nodeId: "footer-1", componentId: "footer-contact", variant: "default", orden: 3, propsJson: "{}" },
      ],
      notas: "",
    };

    let fixtureCounter = 0;
    async function createFixture(tree: unknown = {}): Promise<Fixture> {
      fixtureCounter += 1;
      const n = fixtureCounter;
      const [user] = await db
        .insert(schema.users)
        .values({ email: `rev-verify-${n}@example.com`, passwordHash: "x", name: `Rev Verify ${n}`, role: "staff" })
        .returning({ id: schema.users.id, name: schema.users.name });
      const [client] = await db
        .insert(schema.clients)
        .values({ ownerId: user.id, source: "portal", name: `Cliente Rev ${n}` })
        .returning({ id: schema.clients.id });
      const [project] = await db
        .insert(schema.pixelforgeProjects)
        .values({
          ownerId: user.id,
          clientId: client.id,
          clientCrmId: `crm-rev-${n}`,
          title: `Proyecto Rev ${n}`,
          brainDump: "brain dump",
        })
        .returning({ id: schema.pixelforgeProjects.id });
      // Las 5 filas de artifact (una por kind, en `pending`) que
      // createPixelforgeProject crea normalmente — createFixture inserta el
      // proyecto directamente, así que las siembra a mano.
      const ARTIFACT_KINDS = [
        "context_brief",
        "landing_dna",
        "visual_dna",
        "direction_decision",
        "narrative_blueprint",
      ] as const;
      await db
        .insert(schema.pixelforgeArtifacts)
        .values(ARTIFACT_KINDS.map((kind) => ({ projectId: project.id, kind })));

      const [pv] = await db
        .insert(schema.pixelforgePageVersions)
        .values({ projectId: project.id, version: 1, tree, notas: "", warnings: [], createdByName: user.name })
        .returning({ id: schema.pixelforgePageVersions.id, version: schema.pixelforgePageVersions.version });
      return {
        ownerId: user.id,
        projectId: project.id,
        pageVersionId: pv.id,
        version: pv.version,
        actor: { id: user.id, name: user.name },
      };
    }

    function makeFinding(over: Partial<PixelforgeRepoModule.InsertQaFindingInput>): PixelforgeRepoModule.InsertQaFindingInput {
      return {
        checkCode: over.checkCode ?? "CHK-X-001",
        category: "accesibilidad",
        severity: over.severity ?? "minor",
        blocking: over.blocking ?? false,
        source: "det",
        title: "hallazgo",
        description: "descripción del hallazgo",
        recommendation: "recomendación",
        locationKey: over.locationKey ?? "seccion:hero",
        ...over,
      };
    }

    // Crea un qa_run finalizado sobre `pageVersionId` con el verdict dado.
    async function seedQaRun(
      fx: Fixture,
      pageVersionId: string,
      verdict: NonNullable<SchemaModule.PixelforgeQaRun["verdict"]>,
      opts: { findings?: PixelforgeRepoModule.InsertQaFindingInput[]; humanDecision?: "approved" | "rejected" } = {}
    ): Promise<string> {
      const run = await repo.createQaRun(
        fx.projectId,
        fx.ownerId,
        { pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
        fx.actor
      );
      if (opts.findings?.length) await repo.insertQaFindings(run.id, opts.findings);
      await db.update(schema.pixelforgeQaRuns).set({ status: "running" }).where(eq(schema.pixelforgeQaRuns.id, run.id));
      await repo.finalizeQaRun(run.id, { verdict, scoreTotal: 88, categoryScores: {}, summary: {} });
      if (opts.humanDecision) {
        await repo.recordQaHumanDecision(run.id, fx.ownerId, opts.humanDecision, "decisión de prueba", fx.actor);
      }
      return run.id;
    }

    async function eventsOfType(projectId: string, type: SchemaModule.PixelforgeEvent["type"]) {
      return db
        .select()
        .from(schema.pixelforgeEvents)
        .where(and(eq(schema.pixelforgeEvents.projectId, projectId), eq(schema.pixelforgeEvents.type, type)));
    }

    async function sealArtifact(projectId: string, kind: SchemaModule.PixelforgeArtifact["kind"]) {
      await db
        .update(schema.pixelforgeArtifacts)
        .set({ status: "sealed", sealedContent: { sealed: kind }, sealedAt: new Date(), sealedByName: "seed" })
        .where(and(eq(schema.pixelforgeArtifacts.projectId, projectId), eq(schema.pixelforgeArtifacts.kind, kind)));
    }

    async function reviewRow(reviewId: string) {
      const [r] = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, reviewId)).limit(1);
      return r;
    }

    // ── 1. openReview feliz ──────────────────────────────────────────────────
    console.log("\n── 1. openReview feliz (fila + evento review_opened con treeHash) ──");
    const fx1 = await createFixture(REAL_TREE);
    await seedQaRun(fx1, fx1.pageVersionId, "pass");
    const review1 = await repo.openReview(fx1.projectId, fx1.ownerId, fx1.actor);
    const openedEvents1 = await eventsOfType(fx1.projectId, "review_opened");
    const snap1 = openedEvents1[0]?.snapshot as { treeHash?: string } | null;
    check(
      "openReview crea review in_review + 1 evento review_opened con treeHash sha256:…",
      review1.status === "in_review" &&
        openedEvents1.length === 1 &&
        typeof snap1?.treeHash === "string" &&
        snap1.treeHash.startsWith("sha256:"),
      `status=${review1.status}, eventos=${openedEvents1.length}, treeHash=${snap1?.treeHash?.slice(0, 20)}…`
    );

    // ── 2. openReview con gate cerrado (fail) ────────────────────────────────
    console.log("\n── 2. openReview con gate cerrado (fail) → error ──");
    const fx2 = await createFixture(REAL_TREE);
    await seedQaRun(fx2, fx2.pageVersionId, "fail");
    let gateClosedErr = "";
    try {
      await repo.openReview(fx2.projectId, fx2.ownerId, fx2.actor);
    } catch (err) {
      gateClosedErr = err instanceof Error ? err.message : String(err);
    }
    check(
      "openReview con QA fail lanza error de gate cerrado (no abre review)",
      gateClosedErr.toLowerCase().includes("fail"),
      `error: "${gateClosedErr}"`
    );

    // ── 3. Doble openReview ──────────────────────────────────────────────────
    console.log("\n── 3. Doble openReview → el 2do falla (unique/guard) ──");
    let secondOpenErr = "";
    try {
      await repo.openReview(fx1.projectId, fx1.ownerId, fx1.actor);
    } catch (err) {
      secondOpenErr = err instanceof Error ? err.message : String(err);
    }
    const activeReviews1 = await db
      .select({ id: schema.pixelforgeReviews.id })
      .from(schema.pixelforgeReviews)
      .where(and(eq(schema.pixelforgeReviews.projectId, fx1.projectId), eq(schema.pixelforgeReviews.status, "in_review")));
    check(
      "2do openReview sobre proyecto con review activa falla, queda exactamente 1 activa",
      secondOpenErr.length > 0 && activeReviews1.length === 1,
      `error: "${secondOpenErr}", activas=${activeReviews1.length}`
    );

    // ── 4. addReviewComment: ancla section/finding ───────────────────────────
    console.log("\n── 4. addReviewComment section nodeId real OK; nodeId falso → error; finding de otro run → error ──");
    const okComment = await repo.addReviewComment(
      review1.id,
      fx1.ownerId,
      { anchorType: "section", nodeId: "hero-1", body: "revisar el hero", blocking: false },
      fx1.actor
    );
    let fakeNodeErr = "";
    try {
      await repo.addReviewComment(
        review1.id,
        fx1.ownerId,
        { anchorType: "section", nodeId: "no-existe-999", body: "x", blocking: false },
        fx1.actor
      );
    } catch (err) {
      fakeNodeErr = err instanceof Error ? err.message : String(err);
    }
    // finding perteneciente a OTRO run (otro proyecto).
    const fxOther = await createFixture(REAL_TREE);
    await seedQaRun(fxOther, fxOther.pageVersionId, "pass", { findings: [makeFinding({ checkCode: "CHK-OTRO-001" })] });
    const [foreignFinding] = await db
      .select({ id: schema.pixelforgeQaFindings.id })
      .from(schema.pixelforgeQaFindings)
      .limit(1);
    let foreignFindingErr = "";
    try {
      await repo.addReviewComment(
        review1.id,
        fx1.ownerId,
        { anchorType: "finding", findingId: foreignFinding.id, body: "x", blocking: false },
        fx1.actor
      );
    } catch (err) {
      foreignFindingErr = err instanceof Error ? err.message : String(err);
    }
    check(
      "section real OK, nodeId falso → error, finding de otro run → error",
      okComment.anchorType === "section" && fakeNodeErr.length > 0 && foreignFindingErr.length > 0,
      `okComment=${okComment.id.slice(0, 8)}, fakeNode="${fakeNodeErr.slice(0, 30)}", foreign="${foreignFindingErr.slice(0, 40)}"`
    );
    // Resuelve el comentario para no bloquear futuras aprobaciones de fx1 (no lo usamos, pero limpio).
    await repo.resolveReviewComment(okComment.id, fx1.ownerId, { finalStatus: "resolved", reason: "resuelto en prueba" }, fx1.actor);

    // ── 5. approveReview feliz con pass (sin riesgos) ────────────────────────
    console.log("\n── 5. approveReview feliz (pass, sin riesgos) → approved + releaseReady derivable ──");
    const fx5 = await createFixture(REAL_TREE);
    await seedQaRun(fx5, fx5.pageVersionId, "pass");
    const review5 = await repo.openReview(fx5.projectId, fx5.ownerId, fx5.actor);
    await repo.approveReview(review5.id, fx5.ownerId, { reason: "aprobado sin reservas", risks: [] }, fx5.actor);
    const review5After = await reviewRow(review5.id);
    const approvalEvents5 = await eventsOfType(fx5.projectId, "approval_granted");
    const releaseReady5 = isReleaseReady(review5After, fx5.pageVersionId);
    check(
      "approveReview pass → approved + evento approval_granted + isReleaseReady=true (vigente==anclada)",
      review5After.status === "approved" && approvalEvents5.length === 1 && releaseReady5 === true,
      `status=${review5After.status}, approval_granted=${approvalEvents5.length}, releaseReady=${releaseReady5}`
    );

    // ── 6. approveReview con pass_with_warnings + riesgos ─────────────────────
    console.log("\n── 6. pass_with_warnings: sin cubrir majors → error; blocker en entries → error; cobertura completa → OK ──");
    const fx6 = await createFixture(REAL_TREE);
    await seedQaRun(fx6, fx6.pageVersionId, "pass_with_warnings", {
      findings: [
        makeFinding({ checkCode: "CHK-MAJOR-001", severity: "major", locationKey: "seccion:hero" }),
        makeFinding({ checkCode: "CHK-MAJOR-002", severity: "major", locationKey: "seccion:features" }),
        makeFinding({ checkCode: "CHK-BLOCK-001", severity: "critical", blocking: true, locationKey: "seccion:footer" }),
      ],
      humanDecision: "approved",
    });
    const review6 = await repo.openReview(fx6.projectId, fx6.ownerId, fx6.actor);
    const run6Findings = await db
      .select()
      .from(schema.pixelforgeQaFindings)
      .where(eq(schema.pixelforgeQaFindings.qaRunId, review6.qaRunId));
    const majorA = run6Findings.find((f) => f.checkCode === "CHK-MAJOR-001")!;
    const majorB = run6Findings.find((f) => f.checkCode === "CHK-MAJOR-002")!;
    const blocker = run6Findings.find((f) => f.checkCode === "CHK-BLOCK-001")!;

    let uncoveredErr = "";
    try {
      await repo.approveReview(
        review6.id,
        fx6.ownerId,
        { reason: "aprobar parcial", risks: [{ findingId: majorA.id, rationale: "acepto A" }] },
        fx6.actor
      );
    } catch (err) {
      uncoveredErr = err instanceof Error ? err.message : String(err);
    }
    let blockerErr = "";
    try {
      await repo.approveReview(
        review6.id,
        fx6.ownerId,
        {
          reason: "aprobar con blocker",
          risks: [
            { findingId: majorA.id, rationale: "acepto A" },
            { findingId: majorB.id, rationale: "acepto B" },
            { findingId: blocker.id, rationale: "intento aceptar blocker" },
          ],
        },
        fx6.actor
      );
    } catch (err) {
      blockerErr = err instanceof Error ? err.message : String(err);
    }
    await repo.approveReview(
      review6.id,
      fx6.ownerId,
      {
        reason: "aprobar cobertura completa",
        risks: [
          { findingId: majorA.id, rationale: "acepto major A por costo" },
          { findingId: majorB.id, rationale: "acepto major B por plazo" },
        ],
      },
      fx6.actor
    );
    const review6After = await reviewRow(review6.id);
    const riskEvents6 = await eventsOfType(fx6.projectId, "risk_accepted");
    check(
      "sin cubrir majors → error, blocker en entries → error, cobertura completa → approved + risk_accepted × 2",
      uncoveredErr.length > 0 &&
        blockerErr.length > 0 &&
        review6After.status === "approved" &&
        riskEvents6.length === 2 &&
        Array.isArray(review6After.acceptedRisks) &&
        (review6After.acceptedRisks as unknown[]).length === 2,
      `uncovered="${uncoveredErr.slice(0, 30)}", blocker="${blockerErr.slice(0, 40)}", status=${review6After.status}, risk_accepted=${riskEvents6.length}`
    );

    // ── 7. Comentario blocking open bloquea la aprobación ────────────────────
    console.log("\n── 7. Comentario blocking open → approveReview falla (check 7); resolverlo → aprueba ──");
    const fx7 = await createFixture(REAL_TREE);
    await seedQaRun(fx7, fx7.pageVersionId, "pass");
    const review7 = await repo.openReview(fx7.projectId, fx7.ownerId, fx7.actor);
    const blockingComment = await repo.addReviewComment(
      review7.id,
      fx7.ownerId,
      { anchorType: "general", body: "bloqueo esto", blocking: true },
      fx7.actor
    );
    let blockingApproveErr = "";
    try {
      await repo.approveReview(review7.id, fx7.ownerId, { reason: "intento aprobar", risks: [] }, fx7.actor);
    } catch (err) {
      blockingApproveErr = err instanceof Error ? err.message : String(err);
    }
    await repo.resolveReviewComment(
      blockingComment.id,
      fx7.ownerId,
      { finalStatus: "resolved", reason: "corregido y verificado" },
      fx7.actor
    );
    await repo.approveReview(review7.id, fx7.ownerId, { reason: "ahora sí aprobar", risks: [] }, fx7.actor);
    const review7After = await reviewRow(review7.id);
    check(
      "blocking open → approve falla; tras resolverlo → approved",
      blockingApproveErr.toLowerCase().includes("bloqueante") && review7After.status === "approved",
      `error="${blockingApproveErr.slice(0, 40)}", statusFinal=${review7After.status}`
    );

    // ── 8. Doble approveReview concurrente ───────────────────────────────────
    console.log("\n── 8. DOBLE approveReview CONCURRENTE → exactamente 1 gana, el otro CAS error ──");
    const fx8 = await createFixture(REAL_TREE);
    await seedQaRun(fx8, fx8.pageVersionId, "pass");
    const review8 = await repo.openReview(fx8.projectId, fx8.ownerId, fx8.actor);
    const approveResults = await Promise.allSettled([
      repo.approveReview(review8.id, fx8.ownerId, { reason: "aprobar carrera A", risks: [] }, fx8.actor),
      repo.approveReview(review8.id, fx8.ownerId, { reason: "aprobar carrera B", risks: [] }, fx8.actor),
    ]);
    const approveWins = approveResults.filter((r) => r.status === "fulfilled").length;
    // El perdedor pierde por CAS (ReviewConflictError, si leyó la review antes
    // del commit del ganador) o por el guard de estado (si su SELECT de
    // ownership —fuera del lock— corrió DESPUÉS del commit y ya vio 'approved').
    // Ambos son cierres de carrera legítimos.
    const approveLosses = approveResults.filter((r) => {
      if (r.status !== "rejected") return false;
      const reason = r.reason as Error;
      return reason?.name === "ReviewConflictError" || /no está abierta/i.test(reason?.message ?? "");
    }).length;
    const approvalEvents8 = await eventsOfType(fx8.projectId, "approval_granted");
    check(
      "exactamente 1 approve gana, el otro pierde por CAS/guard, 1 solo evento approval_granted",
      approveWins === 1 && approveLosses === 1 && approvalEvents8.length === 1,
      `wins=${approveWins}, raceLosses=${approveLosses}, approval_granted=${approvalEvents8.length}`
    );

    // ── 9. Carrera approveReview vs insertPageVersion ────────────────────────
    console.log("\n── 9. Carrera approveReview vs insertPageVersion → estados finales consistentes ──");
    const fx9 = await createFixture(REAL_TREE);
    await seedQaRun(fx9, fx9.pageVersionId, "pass");
    const review9 = await repo.openReview(fx9.projectId, fx9.ownerId, fx9.actor);
    const raceResults = await Promise.allSettled([
      repo.approveReview(review9.id, fx9.ownerId, { reason: "aprobar en carrera con recompose", risks: [] }, fx9.actor),
      repo.insertPageVersion(fx9.projectId, fx9.ownerId, { tree: REAL_TREE, notas: "v2", warnings: [] }, fx9.actor),
    ]);
    const approveOk9 = raceResults[0].status === "fulfilled";
    const review9After = await reviewRow(review9.id);
    const versions9 = await db
      .select({ id: schema.pixelforgePageVersions.id, version: schema.pixelforgePageVersions.version })
      .from(schema.pixelforgePageVersions)
      .where(eq(schema.pixelforgePageVersions.projectId, fx9.projectId))
      .orderBy(desc(schema.pixelforgePageVersions.version));
    const vigente9 = versions9[0];
    // Invariante: JAMÁS approved+vigente sobre versión vieja sin superseder.
    const consistent =
      // caso A: approve ganó primero → luego superseded por la recompose (anclada != vigente).
      (approveOk9 && review9After.status === "superseded" && review9After.pageVersionId !== vigente9.id) ||
      // caso B: recompose ganó primero → approve falló (vigente != anclada); review sigue in_review (superseded si la v2 la alcanzó).
      (!approveOk9 && (review9After.status === "superseded" || review9After.status === "in_review"));
    const neverStaleApproved = !(review9After.status === "approved" && review9After.pageVersionId !== vigente9.id);
    check(
      "carrera approve/recompose consistente; NUNCA approved-vigente sobre versión vieja",
      consistent && neverStaleApproved,
      `approveOk=${approveOk9}, reviewStatus=${review9After.status}, anclada=${review9After.pageVersionId === vigente9.id ? "vigente" : "vieja"}`
    );

    // ── 10. insertPageVersion supersede 3 estados ────────────────────────────
    console.log("\n── 10. insertPageVersion supersede in_review / approved / changes_requested con evento correcto ──");
    // 10a. in_review → review_superseded
    const fx10a = await createFixture(REAL_TREE);
    await seedQaRun(fx10a, fx10a.pageVersionId, "pass");
    const r10a = await repo.openReview(fx10a.projectId, fx10a.ownerId, fx10a.actor);
    await repo.addReviewComment(r10a.id, fx10a.ownerId, { anchorType: "general", body: "un comentario", blocking: false }, fx10a.actor);
    await repo.insertPageVersion(fx10a.projectId, fx10a.ownerId, { tree: REAL_TREE, notas: "v2", warnings: [] }, fx10a.actor);
    const r10aAfter = await reviewRow(r10a.id);
    const supEvents10a = await eventsOfType(fx10a.projectId, "review_superseded");
    const comments10a = await db.select().from(schema.pixelforgeReviewComments).where(eq(schema.pixelforgeReviewComments.reviewId, r10a.id));

    // 10b. approved → approval_superseded (conserva acceptedRisks)
    const fx10b = await createFixture(REAL_TREE);
    await seedQaRun(fx10b, fx10b.pageVersionId, "pass_with_warnings", {
      findings: [makeFinding({ checkCode: "CHK-MAJOR-010", severity: "major", locationKey: "seccion:hero" })],
      humanDecision: "approved",
    });
    const r10b = await repo.openReview(fx10b.projectId, fx10b.ownerId, fx10b.actor);
    const f10b = (await db.select().from(schema.pixelforgeQaFindings).where(eq(schema.pixelforgeQaFindings.qaRunId, r10b.qaRunId)))[0];
    await repo.approveReview(r10b.id, fx10b.ownerId, { reason: "aprobar con riesgo", risks: [{ findingId: f10b.id, rationale: "acepto el major" }] }, fx10b.actor);
    await repo.insertPageVersion(fx10b.projectId, fx10b.ownerId, { tree: REAL_TREE, notas: "v2", warnings: [] }, fx10b.actor);
    const r10bAfter = await reviewRow(r10b.id);
    const supEvents10b = await eventsOfType(fx10b.projectId, "approval_superseded");
    const risksPreserved10b = Array.isArray(r10bAfter.acceptedRisks) && (r10bAfter.acceptedRisks as unknown[]).length === 1;

    // 10c. changes_requested → review_superseded
    const fx10c = await createFixture(REAL_TREE);
    await seedQaRun(fx10c, fx10c.pageVersionId, "pass");
    const r10c = await repo.openReview(fx10c.projectId, fx10c.ownerId, fx10c.actor);
    await db.update(schema.pixelforgeProjects).set({ currentStation: "revision" }).where(eq(schema.pixelforgeProjects.id, fx10c.projectId));
    await repo.requestChanges(r10c.id, fx10c.ownerId, { changeKind: "composicion", reason: "recomponer la landing" }, fx10c.actor);
    await repo.insertPageVersion(fx10c.projectId, fx10c.ownerId, { tree: REAL_TREE, notas: "v2", warnings: [] }, fx10c.actor);
    const r10cAfter = await reviewRow(r10c.id);
    const supEvents10c = await eventsOfType(fx10c.projectId, "review_superseded");

    check(
      "supersede: in_review→review_superseded, approved→approval_superseded (riesgos intactos), changes_requested→review_superseded; comentarios conservados",
      r10aAfter.status === "superseded" &&
        supEvents10a.length === 1 &&
        comments10a.length === 1 &&
        r10bAfter.status === "superseded" &&
        supEvents10b.length === 1 &&
        risksPreserved10b &&
        r10cAfter.status === "superseded" &&
        supEvents10c.length === 1,
      `10a=${r10aAfter.status}/${supEvents10a.length}ev/${comments10a.length}com, 10b=${r10bAfter.status}/${supEvents10b.length}ev/riesgos=${risksPreserved10b}, 10c=${r10cAfter.status}/${supEvents10c.length}ev`
    );

    // ── 11. requestChanges: efectos reales + rollback atómico ────────────────
    console.log("\n── 11. requestChanges composición/contenido con efectos reales + rollback atómico ──");
    // 11a. composicion → changes_requested + current_station='produccion'
    const fx11a = await createFixture(REAL_TREE);
    await seedQaRun(fx11a, fx11a.pageVersionId, "pass");
    const r11a = await repo.openReview(fx11a.projectId, fx11a.ownerId, fx11a.actor);
    await db.update(schema.pixelforgeProjects).set({ currentStation: "revision" }).where(eq(schema.pixelforgeProjects.id, fx11a.projectId));
    await repo.requestChanges(r11a.id, fx11a.ownerId, { changeKind: "composicion", reason: "rehacer composición" }, fx11a.actor);
    const r11aAfter = await reviewRow(r11a.id);
    const [proj11a] = await db.select({ st: schema.pixelforgeProjects.currentStation }).from(schema.pixelforgeProjects).where(eq(schema.pixelforgeProjects.id, fx11a.projectId));
    const cr11aEvents = await eventsOfType(fx11a.projectId, "changes_requested");

    // 11b. contenido/contexto → reabre context_brief + invalida downstream + current_station='contexto'
    const fx11b = await createFixture(REAL_TREE);
    await seedQaRun(fx11b, fx11b.pageVersionId, "pass");
    const r11b = await repo.openReview(fx11b.projectId, fx11b.ownerId, fx11b.actor);
    await sealArtifact(fx11b.projectId, "context_brief");
    await sealArtifact(fx11b.projectId, "landing_dna"); // downstream, para verificar invalidación
    await db.update(schema.pixelforgeProjects).set({ currentStation: "revision" }).where(eq(schema.pixelforgeProjects.id, fx11b.projectId));
    await repo.requestChanges(r11b.id, fx11b.ownerId, { changeKind: "contenido", contentTarget: "contexto", reason: "cambiar el brief" }, fx11b.actor);
    const arts11b = await db.select().from(schema.pixelforgeArtifacts).where(eq(schema.pixelforgeArtifacts.projectId, fx11b.projectId));
    const ctxBrief = arts11b.find((a) => a.kind === "context_brief")!;
    const landingDna = arts11b.find((a) => a.kind === "landing_dna")!;
    const [proj11b] = await db.select({ st: schema.pixelforgeProjects.currentStation }).from(schema.pixelforgeProjects).where(eq(schema.pixelforgeProjects.id, fx11b.projectId));
    const reopenedEvents11b = await eventsOfType(fx11b.projectId, "reopened");
    const invalidatedEvents11b = await eventsOfType(fx11b.projectId, "invalidated");

    // 11c. rollback atómico: borro el artifact objetivo → reopenArtifactInTx lanza TRAS el CAS → nada queda escrito.
    const fx11c = await createFixture(REAL_TREE);
    await seedQaRun(fx11c, fx11c.pageVersionId, "pass");
    const r11c = await repo.openReview(fx11c.projectId, fx11c.ownerId, fx11c.actor);
    await db.delete(schema.pixelforgeArtifacts).where(and(eq(schema.pixelforgeArtifacts.projectId, fx11c.projectId), eq(schema.pixelforgeArtifacts.kind, "narrative_blueprint")));
    let rollbackErr = "";
    try {
      await repo.requestChanges(r11c.id, fx11c.ownerId, { changeKind: "estructura", reason: "reabrir blueprint" }, fx11c.actor);
    } catch (err) {
      rollbackErr = err instanceof Error ? err.message : String(err);
    }
    const r11cAfter = await reviewRow(r11c.id);
    const cr11cEvents = await eventsOfType(fx11c.projectId, "changes_requested");

    check(
      "composición→produccion; contenido/contexto reabre context_brief + invalida landing_dna + estación=contexto; rollback atómico deja review in_review y 0 eventos",
      r11aAfter.status === "changes_requested" &&
        proj11a.st === "produccion" &&
        cr11aEvents.length === 1 &&
        ctxBrief.status === "in_progress" &&
        landingDna.status === "invalidated" &&
        proj11b.st === "contexto" &&
        reopenedEvents11b.length === 1 &&
        invalidatedEvents11b.length === 1 &&
        rollbackErr.length > 0 &&
        r11cAfter.status === "in_review" &&
        cr11cEvents.length === 0,
      `11a=${r11aAfter.status}/${proj11a.st}, 11b ctx=${ctxBrief.status}/dna=${landingDna.status}/st=${proj11b.st}, rollback err="${rollbackErr.slice(0, 30)}" reviewStatus=${r11cAfter.status} crEvents=${cr11cEvents.length}`
    );

    // ── 12. reanchorReview ───────────────────────────────────────────────────
    console.log("\n── 12. reanchorReview: nuevo pass → re-ancla; nuevo fail → error, ancla intacta ──");
    const fx12 = await createFixture(REAL_TREE);
    const run12a = await seedQaRun(fx12, fx12.pageVersionId, "pass");
    const review12 = await repo.openReview(fx12.projectId, fx12.ownerId, fx12.actor);
    // nuevo QA pass sobre la MISMA versión.
    const run12b = await seedQaRun(fx12, fx12.pageVersionId, "pass");
    await repo.reanchorReview(review12.id, fx12.ownerId, fx12.actor);
    const review12Reanchored = await reviewRow(review12.id);
    const reanchoredOk = review12Reanchored.qaRunId === run12b && review12Reanchored.qaRunId !== run12a;
    // nuevo QA fail sobre la misma versión → reanchor debe fallar.
    await seedQaRun(fx12, fx12.pageVersionId, "fail");
    let reanchorFailErr = "";
    try {
      await repo.reanchorReview(review12.id, fx12.ownerId, fx12.actor);
    } catch (err) {
      reanchorFailErr = err instanceof Error ? err.message : String(err);
    }
    const review12AfterFail = await reviewRow(review12.id);
    check(
      "reanchor a nuevo pass OK; reanchor a nuevo fail → error y ancla intacta (sigue apuntando al pass)",
      reanchoredOk && reanchorFailErr.length > 0 && review12AfterFail.qaRunId === run12b,
      `reanchoredOk=${reanchoredOk}, failErr="${reanchorFailErr.slice(0, 40)}", anclaFinal=${review12AfterFail.qaRunId === run12b ? "intacta(pass)" : "CAMBIADA"}`
    );

    // ── 13. treeHash corrupto → approveReview falla check 6 ───────────────────
    console.log("\n── 13. treeHash corrupto → approveReview falla (hash no coincide) ──");
    const fx13 = await createFixture(REAL_TREE);
    await seedQaRun(fx13, fx13.pageVersionId, "pass");
    const review13 = await repo.openReview(fx13.projectId, fx13.ownerId, fx13.actor);
    await db.update(schema.pixelforgeReviews).set({ treeHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000" }).where(eq(schema.pixelforgeReviews.id, review13.id));
    let hashErr = "";
    try {
      await repo.approveReview(review13.id, fx13.ownerId, { reason: "aprobar con hash corrupto", risks: [] }, fx13.actor);
    } catch (err) {
      hashErr = err instanceof Error ? err.message : String(err);
    }
    const review13After = await reviewRow(review13.id);
    check(
      "approveReview con treeHash corrupto lanza error de hash y no aprueba",
      hashErr.toLowerCase().includes("hash") && review13After.status === "in_review",
      `error="${hashErr.slice(0, 40)}", status=${review13After.status}`
    );

    // ── 14. DELETE del proyecto arrastra reviews/comments ────────────────────
    console.log("\n── 14. DELETE del proyecto → cascada arrastra reviews + comments ──");
    const fx14 = await createFixture(REAL_TREE);
    await seedQaRun(fx14, fx14.pageVersionId, "pass");
    const review14 = await repo.openReview(fx14.projectId, fx14.ownerId, fx14.actor);
    await repo.addReviewComment(review14.id, fx14.ownerId, { anchorType: "general", body: "comentario a borrar", blocking: false }, fx14.actor);
    await db.delete(schema.pixelforgeProjects).where(eq(schema.pixelforgeProjects.id, fx14.projectId));
    const reviews14 = await db.select({ id: schema.pixelforgeReviews.id }).from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.projectId, fx14.projectId));
    const comments14 = await db.select({ id: schema.pixelforgeReviewComments.id }).from(schema.pixelforgeReviewComments).where(eq(schema.pixelforgeReviewComments.projectId, fx14.projectId));
    check(
      "DELETE proyecto arrastra sus reviews y comments (cascada)",
      reviews14.length === 0 && comments14.length === 0,
      `reviews=${reviews14.length}, comments=${comments14.length}`
    );

    // ── 15. Carrera TOCTOU: approveReview vs addReviewComment(blocking) ───────
    // Carrera REPRODUCIDA en el review de PF-F9 T3: sin lock en
    // addReviewComment, un comentario blocking+open podía colarse ENTRE el
    // conteo de blockers de approveReview (paso 7, ve 0) y su CAS, dejando
    // 'approved' + comentario blocking && open (estado PROHIBIDO por el GO).
    // Se lanzan ambas en PARALELO (Promise.allSettled, 2 corridas concurrentes
    // que van a conexiones distintas del pool → compiten por el FOR UPDATE del
    // proyecto) con jitter, N iteraciones. Invariante duro por iteración: NUNCA
    // (status='approved' AND existe comentario blocking open). Los 3 desenlaces
    // legales: (a) comment antes → approve falla por blockers; (b) approve antes
    // → comment falla por guard in_review; (c) comment falla por otra razón
    // legítima (p.ej. serialización).
    console.log("\n── 15. Carrera approveReview vs addReviewComment(blocking) → NUNCA approved+blocking-open ──");
    const ITERS_15 = 25;
    const jitter = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4)));
    let violated15 = 0;
    let bugBoth15 = 0;
    let aCommentFirst15 = 0; // comment gana, approve falla por blockers
    let bApproveFirst15 = 0; // approve gana, comment falla por guard in_review
    let cOtherLegit15 = 0; // comment falla por otra razón legítima
    let unclassified15 = 0;
    for (let i = 0; i < ITERS_15; i += 1) {
      const fx15 = await createFixture(REAL_TREE);
      await seedQaRun(fx15, fx15.pageVersionId, "pass");
      const review15 = await repo.openReview(fx15.projectId, fx15.ownerId, fx15.actor);
      const settled = await Promise.allSettled([
        (async () => {
          await jitter();
          return repo.approveReview(review15.id, fx15.ownerId, { reason: `aprobar carrera ${i}`, risks: [] }, fx15.actor);
        })(),
        (async () => {
          await jitter();
          return repo.addReviewComment(
            review15.id,
            fx15.ownerId,
            { anchorType: "general", body: `bloqueo en carrera ${i}`, blocking: true },
            fx15.actor
          );
        })(),
      ]);
      const approveOk = settled[0].status === "fulfilled";
      const commentOk = settled[1].status === "fulfilled";
      const commentErr =
        settled[1].status === "rejected"
          ? (settled[1].reason as Error)?.message ?? String(settled[1].reason)
          : "";
      const approveErr =
        settled[0].status === "rejected"
          ? (settled[0].reason as Error)?.message ?? String(settled[0].reason)
          : "";

      // Invariante duro releído de la DB: jamás approved + blocking open.
      const [rv] = await db
        .select({ status: schema.pixelforgeReviews.status })
        .from(schema.pixelforgeReviews)
        .where(eq(schema.pixelforgeReviews.id, review15.id))
        .limit(1);
      const blockingOpen = await db
        .select({ id: schema.pixelforgeReviewComments.id })
        .from(schema.pixelforgeReviewComments)
        .where(
          and(
            eq(schema.pixelforgeReviewComments.projectId, fx15.projectId),
            eq(schema.pixelforgeReviewComments.blocking, true),
            eq(schema.pixelforgeReviewComments.status, "open")
          )
        );
      if (rv.status === "approved" && blockingOpen.length > 0) violated15 += 1;

      // Clasificación de desenlaces.
      if (approveOk && commentOk) {
        bugBoth15 += 1; // ambos ganaron → produciría el estado prohibido.
      } else if (commentOk && !approveOk && /bloqueante/i.test(approveErr)) {
        aCommentFirst15 += 1;
      } else if (approveOk && !commentOk && /revisi[oó]n abierta/i.test(commentErr)) {
        bApproveFirst15 += 1;
      } else if (!commentOk) {
        cOtherLegit15 += 1;
      } else {
        unclassified15 += 1;
      }
    }
    check(
      "carrera approve/comment(blocking) × 25: NUNCA approved+blocking-open; todos los desenlaces legales",
      violated15 === 0 && bugBoth15 === 0 && unclassified15 === 0,
      `violaciones=${violated15}, bugAmbosGanaron=${bugBoth15}, desenlaces: a(commentFirst→approveBlocked)=${aCommentFirst15}, b(approveFirst→commentInReview)=${bApproveFirst15}, c(commentFallaOtra)=${cOtherLegit15}, sinClasificar=${unclassified15}`
    );

    await db.$client.end();
  } finally {
    console.log(`\nDestruyendo contenedor ${CONTAINER_NAME}...`);
    execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  }

  console.log("\n── Resumen ──");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks OK.`);
  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} check(s) fallaron:`);
    failed.forEach((f) => console.error(`   - ${f.label}${f.detail ? ` (${f.detail})` : ""}`));
    process.exit(1);
  }
  console.log("\n✅ Todos los checks de repo de revisión pasaron.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error inesperado en el verify de repo de revisión:", err);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  process.exit(1);
});
