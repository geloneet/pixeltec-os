/**
 * Fase 3 — Migración de datos Firestore → Postgres.
 *
 * Lee TODAS las colecciones en alcance del plan maestro directo desde
 * Firestore (Admin SDK) y las carga en Postgres vía Drizzle, sin pasar por
 * un archivo intermedio en disco (evita dejar una copia de PII sentada
 * fuera de las dos bases de datos que ya la tienen).
 *
 * Idempotente: cada tabla migrada tiene un índice único en `firestore_id`
 * (o una clave natural, ej. email/slug) — volver a correr este script no
 * duplica filas (usa onConflictDoNothing).
 *
 * Firestore NO se modifica (solo lectura) — sigue siendo la fuente de
 * verdad hasta que la Fase 4 corte el tráfico real a Postgres.
 *
 * Uso: docker compose --profile tools run --rm seed npx tsx scripts/migrate-firestore-to-postgres.ts
 *      (reutiliza el contenedor `seed` — mismo env-file/red que necesita
 *      esta migración: DATABASE_URL + credenciales de Firebase Admin)
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { getAdminFirestore } from "../src/lib/firebase-admin";
import { colorBucketFor } from "../src/lib/assistant/history-stats";
import * as schema from "../src/lib/db/schema";

const {
  users,
  clients,
  clientPortalUpdates,
  clientPortalProjects,
  portalRequests,
  projects,
  projectKeys,
  tasks,
  recurringCharges,
  projectLogEntries,
  tools,
  knowledgeTips,
  workSessions,
  serverLinks,
  userStreak,
  proposals,
  growthSocialAccounts,
  blogPosts,
  blogBriefs,
  leads,
  newsletterSubscribers,
  notifications,
  activity,
  infraAuditLog,
  cspViolations,
  legacyTasks,
  assistantTasks,
  assistantTemplates,
  assistantTasksArchive,
  assistantWeeklyReports,
  finances,
  tickets,
  cryptoAlertRules,
  cryptoTelegramUsers,
} = schema;

// Firestore puede devolver Timestamp (con .toDate()), string ISO, o Date.
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toDateOrNow(value: unknown): Date {
  return toDate(value) ?? new Date(0);
}

async function main() {
  const firestore = getAdminFirestore();

  // Único usuario real hoy — todo el contenido "scoped por owner" es suyo.
  const [adminUser] = await db.select().from(users).limit(1);
  if (!adminUser) throw new Error("No hay usuario admin — corre scripts/seed.ts primero.");
  const ownerId = adminUser.id;

  const counts: Record<string, number> = {};

  // ── 1. crm_data/{uid} — núcleo CRM (blob → relacional) ──────────────────
  const crmSnap = await firestore.collection("crm_data").get();
  const blobClientIdMap = new Map<string, string>(); // firestore client.id -> pg clients.id
  const projectIdMap = new Map<string, string>();
  const taskIdMap = new Map<string, string>();

  for (const doc of crmSnap.docs) {
    const data = doc.data() as {
      clients?: Array<Record<string, any>>;
      tools?: Array<Record<string, any>>;
      streak?: number;
      serverLinks?: Record<string, string>;
      sessions?: Array<Record<string, any>>;
    };

    for (const c of data.clients ?? []) {
      const [row] = await db
        .insert(clients)
        .values({
          ownerId,
          source: "crm_blob",
          firestoreId: c.id,
          name: c.name ?? "(sin nombre)",
          contactName: c.contactName ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          location: c.location ?? null,
          notes: c.notes ?? "",
          portalToken: c.portalToken ?? null,
          portalEnabled: !!c.portalEnabled,
          createdAt: toDateOrNow(c.createdAt),
        })
        .onConflictDoNothing({ target: clients.firestoreId })
        .returning({ id: clients.id });
      const clientPgId =
        row?.id ??
        (await db.select({ id: clients.id }).from(clients).where(eq(clients.firestoreId, c.id)).limit(1))[0]?.id;
      if (!clientPgId) continue;
      blobClientIdMap.set(c.id, clientPgId);
      counts.clients_crm_blob = (counts.clients_crm_blob ?? 0) + 1;

      for (const p of c.projects ?? []) {
        const [prow] = await db
          .insert(projects)
          .values({
            firestoreId: p.id,
            clientId: clientPgId,
            name: p.name ?? "(sin nombre)",
            domain: p.domain ?? "",
            budget: String(p.budget ?? 0),
            annual: String(p.annual ?? 0),
            budgetIva: p.budgetIva ?? "none",
            annualIva: p.annualIva ?? "none",
            tech: p.tech ?? "",
            guides: p.guides ?? "",
            accounts: p.accounts ?? "",
            readme: p.readme ?? "",
            prompt: p.prompt ?? "",
            quickNotes: p.quickNotes ?? "",
            createdAt: toDateOrNow(p.createdAt),
          })
          .onConflictDoNothing({ target: projects.firestoreId })
          .returning({ id: projects.id });
        const projectPgId =
          prow?.id ??
          (await db.select({ id: projects.id }).from(projects).where(eq(projects.firestoreId, p.id)).limit(1))[0]?.id;
        if (!projectPgId) continue;
        projectIdMap.set(p.id, projectPgId);
        counts.projects = (counts.projects ?? 0) + 1;

        for (const k of p.keys ?? []) {
          await db
            .insert(projectKeys)
            .values({ firestoreId: k.id, projectId: projectPgId, label: k.label ?? "", value: k.value ?? "" })
            .onConflictDoNothing({ target: projectKeys.firestoreId });
          counts.project_keys = (counts.project_keys ?? 0) + 1;
        }

        for (const t of p.tasks ?? []) {
          const [trow] = await db
            .insert(tasks)
            .values({
              firestoreId: t.id,
              projectId: projectPgId,
              name: t.name ?? "(sin nombre)",
              desc: t.desc ?? "",
              status: t.status ?? "pendiente",
              prio: t.prio ?? "important",
              pomoSessions: t.pomoSessions ?? 0,
              createdAt: toDateOrNow(t.createdAt),
            })
            .onConflictDoNothing({ target: tasks.firestoreId })
            .returning({ id: tasks.id });
          const taskPgId =
            trow?.id ??
            (await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.firestoreId, t.id)).limit(1))[0]?.id;
          if (taskPgId) taskIdMap.set(t.id, taskPgId);
          counts.tasks = (counts.tasks ?? 0) + 1;
        }

        for (const rc of p.charges ?? []) {
          // amount venía como string libre en Firestore — coerción numérica
          // (mismo bug de src/lib/crm/next-charge-date.ts que motivó el
          // cambio de tipo en el schema).
          const parsed = parseFloat(String(rc.amount).replace(/[^0-9.-]/g, ""));
          await db
            .insert(recurringCharges)
            .values({
              firestoreId: rc.id,
              projectId: projectPgId,
              concept: rc.concept ?? "",
              amount: Number.isFinite(parsed) ? String(parsed) : "0",
              frequency: rc.frequency ?? "monthly",
              startDate: (toDate(rc.startDate) ?? new Date()).toISOString().slice(0, 10),
              clientEmail: rc.clientEmail ?? "",
              active: rc.active ?? true,
              lastNotified: toDate(rc.lastNotified),
              createdAt: toDateOrNow(rc.createdAt),
            })
            .onConflictDoNothing({ target: recurringCharges.firestoreId });
          counts.recurring_charges = (counts.recurring_charges ?? 0) + 1;
        }

        for (const log of p.notesLog ?? []) {
          await db
            .insert(projectLogEntries)
            .values({
              firestoreId: log.id,
              projectId: projectPgId,
              category: log.category ?? "General",
              content: log.content ?? "",
              authorName: log.authorName ?? "",
              createdAt: toDateOrNow(log.createdAt),
            })
            .onConflictDoNothing({ target: projectLogEntries.firestoreId });
          counts.project_log_entries = (counts.project_log_entries ?? 0) + 1;
        }
      }
    }

    for (const tool of data.tools ?? []) {
      const [toolRow] = await db
        .insert(tools)
        .values({
          firestoreId: tool.id,
          ownerId,
          name: tool.name ?? "",
          icon: tool.icon ?? "",
          color: tool.color ?? "",
          createdAt: toDateOrNow(tool.createdAt),
        })
        .onConflictDoNothing({ target: tools.firestoreId })
        .returning({ id: tools.id });
      const toolPgId =
        toolRow?.id ??
        (await db.select({ id: tools.id }).from(tools).where(eq(tools.firestoreId, tool.id)).limit(1))[0]?.id;
      counts.tools = (counts.tools ?? 0) + 1;
      if (!toolPgId) continue;

      for (const tip of tool.tips ?? []) {
        await db
          .insert(knowledgeTips)
          .values({
            firestoreId: tip.id,
            toolId: toolPgId,
            title: tip.title ?? "",
            summary: tip.summary ?? "",
            content: tip.content ?? "",
            tags: tip.tags ?? [],
            createdAt: toDateOrNow(tip.createdAt),
            updatedAt: toDateOrNow(tip.updatedAt),
          })
          .onConflictDoNothing({ target: knowledgeTips.firestoreId });
        counts.knowledge_tips = (counts.knowledge_tips ?? 0) + 1;
      }
    }

    if (typeof data.streak === "number") {
      await db
        .insert(userStreak)
        .values({ userId: ownerId, value: data.streak })
        .onConflictDoUpdate({ target: userStreak.userId, set: { value: data.streak } });
      counts.user_streak = 1;
    }

    for (const [firestoreProjectId, firestoreClientId] of Object.entries(data.serverLinks ?? {})) {
      const pgProjectId = projectIdMap.get(firestoreProjectId);
      const pgClientId = blobClientIdMap.get(firestoreClientId);
      if (!pgProjectId || !pgClientId) continue;
      await db
        .insert(serverLinks)
        .values({ projectId: pgProjectId, clientId: pgClientId })
        .onConflictDoNothing({ target: serverLinks.projectId });
      counts.server_links = (counts.server_links ?? 0) + 1;
    }

    for (const s of data.sessions ?? []) {
      await db
        .insert(workSessions)
        .values({
          firestoreId: s.id,
          ownerId,
          clientId: blobClientIdMap.get(s.clientId) ?? null,
          projectId: projectIdMap.get(s.projectId) ?? null,
          taskId: taskIdMap.get(s.taskId) ?? null,
          clientName: s.clientName ?? "",
          projectName: s.projectName ?? "",
          taskName: s.taskName ?? "",
          startedAt: toDateOrNow(s.startedAt),
          endedAt: toDate(s.endedAt),
          durationSeconds: s.durationSeconds ?? null,
          status: s.status ?? "completed",
          currentActivity: s.currentActivity ?? null,
          activities: s.activities ?? [],
          notes: s.notes ?? [],
          blockers: s.blockers ?? [],
          sessionGoals: s.sessionGoals ?? [],
          deployStatus: s.deployStatus ?? null,
          commitStatus: s.commitStatus ?? null,
          createdBy: s.createdBy ?? "",
        })
        .onConflictDoNothing({ target: workSessions.firestoreId });
      counts.work_sessions = (counts.work_sessions ?? 0) + 1;
    }
  }

  // ── 2. Colección top-level `clients` — roster de negocio + portal OTP ──
  const portalClientIdMap = new Map<string, string>();
  const topClientsSnap = await firestore.collection("clients").get();
  for (const doc of topClientsSnap.docs) {
    const d = doc.data();
    const [row] = await db
      .insert(clients)
      .values({
        ownerId,
        source: "portal",
        firestoreId: doc.id,
        name: d.companyName ?? "(sin nombre)",
        contactName: d.contactName ?? null,
        email: d.contactEmail ?? null,
        whatsapp: d.whatsapp ?? null,
        website: d.website ?? null,
        techStack: d.techStack ?? null,
        services: d.services ?? [],
        status: d.status ?? null,
        clientValue: d.clientValue != null ? String(d.clientValue) : null,
        assignedTo: d.assignedTo ?? null,
        location: d.location ?? null,
        initialNotes: d.initialNotes ?? null,
        color: d.color ?? null,
        logoUrl: d.logoUrl ?? null,
        taskProgress: d.taskProgress ?? null,
        slug: d.slug ?? null,
        accessCodeHash: d.accessCodeHash ?? null,
        accessCodeExpiresAt: toDate(d.accessCodeExpiresAt),
        lastCodeRequestAt: toDate(d.lastCodeRequestAt),
        createdAt: toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: clients.firestoreId })
      .returning({ id: clients.id });
    const clientPgId =
      row?.id ??
      (await db.select({ id: clients.id }).from(clients).where(eq(clients.firestoreId, doc.id)).limit(1))[0]?.id;
    counts.clients_portal = (counts.clients_portal ?? 0) + 1;
    if (!clientPgId) continue;
    portalClientIdMap.set(doc.id, clientPgId);

    const updatesSnap = await doc.ref.collection("updates").get();
    for (const u of updatesSnap.docs) {
      const ud = u.data();
      await db
        .insert(clientPortalUpdates)
        .values({
          firestoreId: u.id,
          clientId: clientPgId,
          text: ud.text ?? "",
          imageUrl: ud.imageUrl ?? null,
          createdBy: ud.createdBy ?? "",
          createdAt: toDateOrNow(ud.createdAt),
        })
        .onConflictDoNothing({ target: clientPortalUpdates.firestoreId });
      counts.client_portal_updates = (counts.client_portal_updates ?? 0) + 1;
    }

    const projSnap = await doc.ref.collection("projects").get();
    for (const p of projSnap.docs) {
      const pd = p.data();
      await db
        .insert(clientPortalProjects)
        .values({ firestoreId: p.id, clientId: clientPgId, name: pd.name ?? "", status: pd.status ?? "" })
        .onConflictDoNothing({ target: clientPortalProjects.firestoreId });
      counts.client_portal_projects = (counts.client_portal_projects ?? 0) + 1;
    }
  }

  // Resuelve un clientId de Firestore contra cualquiera de los dos mapas
  // (blob o portal) — proposals/contracts/invoices no distinguen origen.
  const resolveClientId = (firestoreClientId: string | undefined | null): string | null =>
    (firestoreClientId && (blobClientIdMap.get(firestoreClientId) ?? portalClientIdMap.get(firestoreClientId))) ||
    null;

  // Solicitudes del portal OTP — colección top-level `portal_requests`.
  const portalRequestsSnap = await firestore.collection("portal_requests").get();
  for (const doc of portalRequestsSnap.docs) {
    const d = doc.data();
    const clientPgId = resolveClientId(d.clientId);
    if (!clientPgId) {
      console.warn(`  [portal_requests] ${doc.id}: clientId ${d.clientId} no resuelve — omitida`);
      continue;
    }
    await db
      .insert(portalRequests)
      .values({
        firestoreId: doc.id,
        uid: d.uid ?? "",
        clientId: clientPgId,
        token: d.token ?? "",
        type: d.type ?? "solicitud",
        title: d.title ?? "",
        description: d.description ?? "",
        status: d.status ?? "recibida",
        linkedTaskId: d.linkedTaskId ?? null,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
      })
      .onConflictDoNothing({ target: portalRequests.firestoreId });
    counts.portal_requests = (counts.portal_requests ?? 0) + 1;
  }

  // ── 3. proposals (contracts/invoices/discoverySessions/strategies/ia_templates están vacíos hoy) ──
  const proposalsSnap = await firestore.collection("proposals").get();
  for (const doc of proposalsSnap.docs) {
    const d = doc.data();
    const clientPgId = resolveClientId(d.clientId);
    if (!clientPgId) {
      console.warn(`[migrate] proposal ${doc.id}: clientId ${d.clientId} sin mapeo — se omite`);
      continue;
    }
    await db
      .insert(proposals)
      .values({
        firestoreId: doc.id,
        ownerId,
        clientId: clientPgId,
        clientName: d.clientName ?? "",
        reference: d.reference ?? null,
        title: d.title ?? "",
        scope: d.scope ?? "",
        solution: d.solution ?? null,
        deliverables: d.deliverables ?? null,
        benefits: d.benefits ?? null,
        budget: d.budget ?? null,
        timeline: d.timeline ?? null,
        status: d.status ?? "borrador",
        publicToken: d.publicToken ?? null,
        viewCount: d.viewCount ?? 0,
        viewEvents: d.viewEvents ?? [],
        currentVersion: d.currentVersion ?? 1,
        versions: d.versions ?? [],
        sentAt: toDate(d.sentAt),
        viewedAt: toDate(d.viewedAt),
        acceptedAt: toDate(d.acceptedAt),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
      })
      .onConflictDoNothing({ target: proposals.firestoreId });
    counts.proposals = (counts.proposals ?? 0) + 1;
  }

  // ── 4. growthSocialAccounts (growthBrands/Posts/Campaigns/Credits/Ledger/Jobs vacíos hoy) ──
  const socialSnap = await firestore.collection("growthSocialAccounts").get();
  for (const doc of socialSnap.docs) {
    const d = doc.data();
    await db
      .insert(growthSocialAccounts)
      .values({
        firestoreId: doc.id,
        ownerId,
        platform: d.platform ?? "",
        status: d.status ?? "connected",
        facebookUserId: d.facebookUserId ?? "",
        facebookPageId: d.facebookPageId ?? "",
        facebookPageName: d.facebookPageName ?? "",
        accessToken: d.accessToken ?? "",
        tokenExpiresAt: toDateOrNow(d.tokenExpiresAt),
        instagramBusinessId: d.instagramBusinessId ?? null,
        instagramUsername: d.instagramUsername ?? null,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
      })
      .onConflictDoNothing({ target: growthSocialAccounts.firestoreId });
    counts.growth_social_accounts = (counts.growth_social_accounts ?? 0) + 1;
  }

  // ── 5. Blog ──────────────────────────────────────────────────────────────
  const blogPostsSnap = await firestore.collection("blogPosts").get();
  for (const doc of blogPostsSnap.docs) {
    const d = doc.data();
    // `ai.generatedAt` es Timestamp de Firestore — serializar a ISO para JSONB.
    const ai = d.ai
      ? { ...d.ai, generatedAt: toDate(d.ai.generatedAt)?.toISOString() ?? null }
      : {};
    await db
      .insert(blogPosts)
      .values({
        firestoreId: doc.id,
        slug: d.slug ?? doc.id,
        title: d.title ?? "",
        category: d.category ?? "",
        excerpt: d.excerpt ?? "",
        body: d.body ?? "",
        tags: d.tags ?? [],
        coverImage: d.coverImage ?? null,
        author: d.author ?? {},
        status: d.status ?? "draft",
        briefSource: d.briefSource ?? {},
        ai,
        seo: d.seo ?? {},
        wordCount: d.wordCount ?? 0,
        readingTimeMin: d.readingTimeMin ?? 1,
        approvedBy: d.approvedBy ?? null,
        publishedAt: toDate(d.publishedAt),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
      })
      .onConflictDoNothing({ target: blogPosts.firestoreId });
    counts.blog_posts = (counts.blog_posts ?? 0) + 1;
  }

  const blogBriefsSnap = await firestore.collection("blogBriefs").get();
  for (const doc of blogBriefsSnap.docs) {
    const d = doc.data();
    await db
      .insert(blogBriefs)
      .values({ firestoreId: doc.id, data: d, createdAt: toDateOrNow(d.createdAt) })
      .onConflictDoNothing({ target: blogBriefs.firestoreId });
    counts.blog_briefs = (counts.blog_briefs ?? 0) + 1;
  }

  // ── 6. Funnel público ────────────────────────────────────────────────────
  const leadsSnap = await firestore.collection("leads").get();
  for (const doc of leadsSnap.docs) {
    const d = doc.data();
    await db
      .insert(leads)
      .values({
        firestoreId: doc.id,
        source: d.source ?? "contact_form",
        email: d.email ?? "",
        name: d.name ?? null,
        message: d.message ?? null,
        userAgent: d.userAgent ?? null,
        ipHash: d.ipHash ?? null,
        status: d.status ?? "new",
        emailDeliveryStatus: d.emailDeliveryStatus ?? "pending",
        consentTimestamp: toDateOrNow(d.consentTimestamp),
        createdAt: toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: leads.firestoreId });
    counts.leads = (counts.leads ?? 0) + 1;
  }

  const newsletterSnap = await firestore.collection("newsletterSubscribers").get();
  for (const doc of newsletterSnap.docs) {
    const d = doc.data();
    await db
      .insert(newsletterSubscribers)
      .values({
        email: d.email ?? "",
        status: d.status ?? "active",
        subscribedAt: toDateOrNow(d.subscribedAt),
        source: d.source ?? "",
        unsubscribeToken: d.unsubscribeToken ?? doc.id,
        reactivatedAt: toDate(d.reactivatedAt),
      })
      .onConflictDoNothing({ target: newsletterSubscribers.email });
    counts.newsletter_subscribers = (counts.newsletter_subscribers ?? 0) + 1;
  }

  // ── 7. Notificaciones / auditoría ────────────────────────────────────────
  const notificationsSnap = await firestore.collection("notifications").get();
  for (const doc of notificationsSnap.docs) {
    const d = doc.data();
    // userId en Firestore es el Firebase UID — todo pertenece al único
    // usuario real hoy (mismo firebaseUid que el admin seedeado).
    await db
      .insert(notifications)
      .values({
        firestoreId: doc.id,
        userId: ownerId,
        type: d.type ?? "system",
        title: d.title ?? "",
        body: d.body ?? "",
        href: d.href ?? null,
        source: d.source ?? "",
        read: !!d.read,
        readAt: toDate(d.readAt),
        metadata: {},
        createdAt: toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: notifications.firestoreId });
    counts.notifications = (counts.notifications ?? 0) + 1;
  }

  const activitySnap = await firestore.collection("activity").get();
  for (const doc of activitySnap.docs) {
    const d = doc.data();
    await db
      .insert(activity)
      .values({
        firestoreId: doc.id,
        type: d.type ?? "",
        message: d.message ?? "",
        link: d.link ?? null,
        createdAt: toDateOrNow(d.timestamp),
      })
      .onConflictDoNothing({ target: activity.firestoreId });
    counts.activity = (counts.activity ?? 0) + 1;
  }

  const infraAuditSnap = await firestore.collection("infraAuditLog").get();
  for (const doc of infraAuditSnap.docs) {
    const d = doc.data();
    await db.insert(infraAuditLog).values({
      type: d.type ?? "",
      uid: d.uid ?? null,
      route: d.route ?? null,
      ip: d.ip ?? null,
      userAgent: d.userAgent ?? null,
      createdAt: toDateOrNow(d.timestamp),
    });
    counts.infra_audit_log = (counts.infra_audit_log ?? 0) + 1;
  }

  const cspSnap = await firestore.collection("cspViolations").get();
  for (const doc of cspSnap.docs) {
    const d = doc.data();
    await db.insert(cspViolations).values({
      blockedUri: d.blockedURI ?? null,
      violatedDirective: d.violatedDirective ?? null,
      sourceFile: d.sourceFile ?? null,
      lineNumber: d.lineNumber ?? null,
      documentUri: d.documentURI ?? null,
      userAgent: d.userAgent ?? null,
      createdAt: toDateOrNow(d.timestamp),
    });
    counts.csp_violations = (counts.csp_violations ?? 0) + 1;
  }

  // ── 8. Asistente ─────────────────────────────────────────────────────────
  // Colección top-level `tasks` — datos legacy muertos (nada los lee en la
  // app; NO es el planner semanal). Se preservan en `legacy_tasks`.
  const legacyTasksSnap = await firestore.collection("tasks").get();
  for (const doc of legacyTasksSnap.docs) {
    const d = doc.data();
    await db
      .insert(legacyTasks)
      .values({
        firestoreId: doc.id,
        ownerId,
        title: d.title ?? "",
        responsible: d.responsible ?? null,
        status: d.status ?? "pendiente",
        dueDate: d.dueDate ? toDateOrNow(d.dueDate).toISOString().slice(0, 10) : null,
        createdAt: toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: legacyTasks.firestoreId });
    counts.legacy_tasks = (counts.legacy_tasks ?? 0) + 1;
  }

  // Planner semanal real: `assistantTasks` (semana viva). `templateId`
  // conserva el id crudo del template en Firestore (id público post-migración).
  const assistantTasksSnap = await firestore.collection("assistantTasks").get();
  for (const doc of assistantTasksSnap.docs) {
    const d = doc.data();
    await db
      .insert(assistantTasks)
      .values({
        firestoreId: doc.id,
        ownerId,
        title: d.title ?? "",
        description: d.description ?? null,
        category: d.category ?? "trabajo",
        startsAt: toDateOrNow(d.startsAt),
        durationMin: d.durationMin ?? 60,
        status: d.status ?? "pending",
        weekKey: d.weekKey ?? "",
        templateId: d.templateId ?? null,
        important: !!d.important,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
      })
      .onConflictDoNothing({ target: assistantTasks.firestoreId });
    counts.assistant_tasks = (counts.assistant_tasks ?? 0) + 1;
  }

  const assistantTemplatesSnap = await firestore.collection("assistantTemplates").get();
  for (const doc of assistantTemplatesSnap.docs) {
    const d = doc.data();
    await db
      .insert(assistantTemplates)
      .values({
        firestoreId: doc.id,
        ownerId,
        title: d.title ?? "",
        description: d.description ?? null,
        category: d.category ?? "trabajo",
        rrule: d.rrule ?? "",
        defaultTime: d.defaultTime ?? "09:00",
        durationMin: d.durationMin ?? 60,
        active: d.active ?? true,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
      })
      .onConflictDoNothing({ target: assistantTemplates.firestoreId });
    counts.assistant_templates = (counts.assistant_templates ?? 0) + 1;
  }

  const assistantArchiveSnap = await firestore.collection("assistantTasksArchive").get();
  for (const doc of assistantArchiveSnap.docs) {
    const d = doc.data();
    await db
      .insert(assistantTasksArchive)
      .values({
        firestoreId: doc.id,
        ownerId,
        title: d.title ?? "",
        description: d.description ?? null,
        category: d.category ?? "trabajo",
        startsAt: toDateOrNow(d.startsAt),
        durationMin: d.durationMin ?? 60,
        status: d.status ?? "pending",
        weekKey: d.weekKey ?? "",
        templateId: d.templateId ?? null,
        important: !!d.important,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt),
        archivedAt: toDateOrNow(d.archivedAt),
      })
      .onConflictDoNothing({ target: assistantTasksArchive.firestoreId });
    counts.assistant_tasks_archive = (counts.assistant_tasks_archive ?? 0) + 1;
  }

  // Reportes semanales — columnas reales (antes blob jsonb `data`).
  // Doc id de Firestore = `${uid}_${weekKey}` → firestoreId (id público).
  // `colorBucket` no existía en los docs — se materializa desde totals
  // (misma fórmula que la UI: colorBucketFor de history-stats).
  const weeklyReportsSnap = await firestore.collection("assistantWeeklyReports").get();
  for (const doc of weeklyReportsSnap.docs) {
    const d = doc.data();
    const total = d.totals?.total ?? 0;
    const rate = total > 0 ? (d.totals?.completed ?? 0) / total : 0;
    await db
      .insert(assistantWeeklyReports)
      .values({
        firestoreId: doc.id,
        ownerId,
        weekKey: d.weekKey ?? doc.id,
        weekStart: toDateOrNow(d.weekStart),
        weekEnd: toDateOrNow(d.weekEnd),
        totals: d.totals ?? {},
        byCategory: d.byCategory ?? {},
        generatedAt: toDateOrNow(d.generatedAt),
        generatedBy: d.generatedBy ?? "cron",
        colorBucket: colorBucketFor(rate, total),
        whatsappMessageId: d.whatsappMessageId ?? null,
        whatsappSentAt: toDate(d.whatsappSentAt),
        whatsappError: d.whatsappError ?? null,
        telegramMessageId: d.telegramMessageId ?? null,
        telegramSentAt: toDate(d.telegramSentAt),
        emailSentAt: toDate(d.emailSentAt),
      })
      .onConflictDoNothing({ target: [assistantWeeklyReports.ownerId, assistantWeeklyReports.weekKey] });
    counts.assistant_weekly_reports = (counts.assistant_weekly_reports ?? 0) + 1;
  }

  // ── 9. Legacy — finances / tickets ──────────────────────────────────────
  const financesSnap = await firestore.collection("finances").get();
  for (const doc of financesSnap.docs) {
    const d = doc.data();
    await db
      .insert(finances)
      .values({
        firestoreId: doc.id,
        clientName: d.clientName ?? "",
        projectName: d.projectName ?? null,
        amount: String(d.amount ?? 0),
        type: d.type ?? "",
        status: d.status ?? "",
        method: d.method ?? null,
        date: toDateOrNow(d.date),
      })
      .onConflictDoNothing({ target: finances.firestoreId });
    counts.finances = (counts.finances ?? 0) + 1;
  }

  const ticketsSnap = await firestore.collection("tickets").get();
  for (const doc of ticketsSnap.docs) {
    const d = doc.data();
    await db
      .insert(tickets)
      .values({
        firestoreId: doc.id,
        ticketId: d.ticketId ?? doc.id,
        cliente: d.cliente ?? "",
        problema: d.problema ?? "",
        categoria: d["categoría"] ?? d.categoria ?? null,
        prioridad: d.prioridad ?? null,
        estado: d.estado ?? "Abierto",
        createdAt: toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: tickets.firestoreId });
    counts.tickets = (counts.tickets ?? 0) + 1;
  }

  // ── 10. Crypto-Intel — alertRules + telegramUsers (con datos reales) ────
  // prices/priceSnapshots/alerts/cryptoIntelLogs NO se migran (decisión
  // aceptada — arrancan vacíos, ver plan maestro).
  const alertRulesSnap = await firestore.collection("alertRules").get();
  for (const doc of alertRulesSnap.docs) {
    const d = doc.data();
    await db
      .insert(cryptoAlertRules)
      .values({
        firestoreId: doc.id,
        userId: d.userId ?? "",
        symbol: d.symbol ?? "",
        type: d.type ?? "price_below",
        params: d.params ?? {},
        channels: d.channels ?? [],
        cooldownMinutes: d.cooldownMinutes ?? 60,
        active: d.active ?? true,
        lastTriggeredAt: toDate(d.lastTriggeredAt),
        telegramChatId: d.telegramChatId ?? null,
        displayName: d.displayName ?? null,
        triggerCount: d.triggerCount ?? 0,
        deletedAt: toDate(d.deletedAt),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDate(d.updatedAt) ?? toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: cryptoAlertRules.firestoreId });
    counts.crypto_alert_rules = (counts.crypto_alert_rules ?? 0) + 1;
  }

  // Doc id de Firestore = el Telegram ID (string) → PK natural `telegramId`.
  const telegramUsersSnap = await firestore.collection("telegramUsers").get();
  for (const doc of telegramUsersSnap.docs) {
    const d = doc.data();
    await db
      .insert(cryptoTelegramUsers)
      .values({
        telegramId: doc.id,
        telegramUserId: d.telegramUserId ?? Number(doc.id),
        telegramUsername: d.telegramUsername ?? null,
        firstName: d.firstName ?? null,
        timezone: d.timezone ?? "America/Mexico_City",
        role: d.role ?? "operator",
        authorized: d.authorized ?? true,
        createdAt: toDateOrNow(d.createdAt),
      })
      .onConflictDoNothing({ target: cryptoTelegramUsers.telegramId });
    counts.crypto_telegram_users = (counts.crypto_telegram_users ?? 0) + 1;
  }

  console.log("\n=== Migración Fase 3 completada — filas insertadas por tabla ===");
  for (const [table, n] of Object.entries(counts).sort()) {
    console.log(`${table.padEnd(28)} ${n}`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`${"TOTAL".padEnd(28)} ${total}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en la migración:", err);
  process.exit(1);
});
