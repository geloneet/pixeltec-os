/**
 * Schema Drizzle — nuevo stack destino (Postgres 16 + Drizzle ORM).
 *
 * Migración de pixeltec-os desde Firestore. Ver
 * docs/superpowers/plans/2026-07-07-firebase-to-postgres-drizzle-nextauth-migration.md
 * para el contexto completo (6 fases) y el plan de ejecución de Fase 0+1 en
 * /home/ubuntu/.claude/plans/mellow-moseying-newell.md.
 *
 * Patrón: espejo de `dalk/src/lib/db/schema.ts` (mismo VPS, mismo stack ya
 * en producción ahí) — `pgTable`, `pgEnum`, `uuid().primaryKey().defaultRandom()`,
 * índices únicos/compuestos, `$inferSelect`/`$inferInsert` por tabla.
 *
 * IMPORTANTE: este schema NO está conectado a ninguna ruta/página real
 * todavía. Firebase/Firestore sigue siendo el único datastore en producción.
 * Es la Fase 1 (schema + capa de datos) del plan de 6 fases — construida en
 * paralelo, cero riesgo para lo que hoy sirve tráfico.
 *
 * Decisión de modelado: los tipos actuales (src/types/*.ts) que hoy viven
 * como sub-objetos anidados dentro de un blob JSON de Firestore se
 * normalizan a tablas relacionales SOLO cuando el núcleo CRM lo justifica
 * (es el reto central de la migración — ver decisión 1 del plan maestro).
 * Para el resto de dominios (Growth Suite, blog) se usa JSONB pragmático en
 * sub-estructuras de configuración semi-estructurada que no necesitan
 * queries relacionales finas en esta primera pasada.
 */

import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ════════════════════════════════════════════════════════════════════════
// Enums
// ════════════════════════════════════════════════════════════════════════

export const userRoleEnum = pgEnum("user_role", ["admin", "staff"]);

export const ivaEnum = pgEnum("iva_mode", ["none", "plus", "included"]);

export const taskStatusEnum = pgEnum("task_status", [
  "pendiente",
  "en_progreso",
  "en_revision",
  "completado",
  "pausado",
  "bloqueado",
]);

export const taskPrioEnum = pgEnum("task_prio", [
  "urgent_important",
  "important",
  "urgent",
  "low",
]);

export const chargeFrequencyEnum = pgEnum("charge_frequency", ["monthly", "annual"]);

export const projectLogCategoryEnum = pgEnum("project_log_category", [
  "General",
  "Cliente",
  "Desarrollo",
  "Infraestructura",
  "Cobros",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "borrador",
  "enviada",
  "vista",
  "aceptada",
  "rechazada",
  "vencida",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "borrador",
  "en_revision",
  "firmado",
  "vencido",
  "cancelado",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "borrador",
  "enviada",
  "vista",
  "pagada",
  "vencida",
  "cancelada",
]);

export const billingFrequencyEnum = pgEnum("billing_frequency", [
  "unico",
  "mensual",
  "trimestral",
  "semestral",
  "anual",
]);

export const billingStatusEnum = pgEnum("billing_status", [
  "pendiente",
  "pagado",
  "vencido",
  "parcial",
  "cancelado",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "efectivo",
  "transferencia",
  "tarjeta",
]);

export const discoveryStatusEnum = pgEnum("discovery_status", [
  "generando",
  "en_progreso",
  "completado",
]);

export const iaTemplateTypeEnum = pgEnum("ia_template_type", [
  "contrato",
  "factura",
  "discovery",
  "estrategia",
  "bienvenida",
  "propuesta",
]);

export const leadSourceEnum = pgEnum("lead_source", ["contact_form", "newsletter", "diagnostic"]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "qualified", "lost"]);
export const emailDeliveryStatusEnum = pgEnum("email_delivery_status", [
  "pending",
  "sent",
  "failed",
]);

export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "active",
  "unsubscribed",
  "bounced",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "info",
  "success",
  "warning",
  "error",
  "alert",
]);

export const organizationPlanEnum = pgEnum("organization_plan", [
  "free",
  "starter",
  "pro",
  "agency",
]);

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "monthly_grant",
  "purchase",
  "charge",
  "refund",
  "manual_grant",
  "trial_grant",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "planning",
  "strategy_ready",
  "generating",
  "review",
  "active",
  "completed",
  "archived",
  // + "pending" ya cubierto por planning en el modelo relacional
]);

export const postStatusEnum = pgEnum("post_status", [
  "generating",
  "draft",
  "approved",
  "scheduled",
  "published",
  "failed",
  "rejected",
]);

export const socialPlatformEnum = pgEnum("social_platform", [
  "instagram",
  "facebook",
  "linkedin",
  "twitter",
]);

export const socialAccountStatusEnum = pgEnum("social_account_status", [
  "connected",
  "expired",
  "error",
]);

// ════════════════════════════════════════════════════════════════════════
// Auth — reemplaza Firebase Auth (usado recién en Fase 2, schema ya listo)
// ════════════════════════════════════════════════════════════════════════

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("staff"),
    // Perfil (Fase 4) — antes displayName/photoURL en Firebase Auth y
    // phone/bio en el doc Firestore `users/{uid}`. El archivo del avatar
    // sigue en Firebase Storage; aquí solo vive la URL pública.
    phone: text("phone"),
    bio: text("bio"),
    image: text("image"),
    // Puente durante la migración de datos (Fase 3): permite reconectar todo
    // lo que hoy está scoped por Firebase UID. Se puede dropear al terminar.
    firebaseUid: text("firebase_uid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_firebase_uid_idx").on(t.firebaseUid),
  ]
);

/**
 * Tokens de recuperación de contraseña (login "¿Olvidaste tu contraseña?",
 * solo para el equipo interno vía NextAuth — la tabla `users`). Igual que
 * `clients.accessCodeHash`, nunca se guarda el token en texto plano: un leak
 * de esta tabla no permite resetear ninguna cuenta.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("password_reset_tokens_user_id_idx").on(t.userId),
    uniqueIndex("password_reset_tokens_token_hash_idx").on(t.tokenHash),
  ]
);

export const userStreak = pgTable("user_streak", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════
// Núcleo CRM — normalización del blob `crm_data/{uid}`
// (src/types/crm.ts — el reto central de la migración)
// ════════════════════════════════════════════════════════════════════════

export const clientSourceEnum = pgEnum("client_source", ["crm_blob", "portal"]);

/**
 * Tabla unificada — Fase 3 reveló que Firestore tiene DOS conceptos de
 * "cliente" completamente separados (cero overlap de IDs, verificado contra
 * datos reales):
 *   1. `crm_data.clients[]` (blob del dashboard personal) — shape simple:
 *      name/email/phone/location/notes/projects[], con `portalToken` propio
 *      (mecanismo /portal/[token], legado, distinto del OTP).
 *   2. Colección top-level `clients` (roster real de negocio + portal OTP)
 *      — shape rico: companyName/whatsapp/website/techStack/services/status/
 *      clientValue/assignedTo/color/logoUrl/taskProgress/slug/accessCode*.
 * 13 clientes reales confirmados entre ambos (3 + 10), sin duplicados. Se
 * fusionan en una sola tabla (decisión de Miguel) — `source` documenta el
 * origen y las columnas que no aplican a ese origen quedan NULL.
 */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: clientSourceEnum("source").notNull(),
    // Bookkeeping de migración (Fase 3): id del doc/array-item original en
    // Firestore — permite re-correr el script de carga de forma idempotente
    // y rastrear el origen de cada fila. No tiene uso en la app una vez
    // migrado.
    firestoreId: text("firestore_id"),

    // Campos comunes (unificados: `name` cubre tanto CRMClient.name como
    // el companyName del portal).
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    location: text("location"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    // Solo origen `crm_blob`:
    portalToken: text("portal_token"), // mecanismo legado /portal/[token]
    portalEnabled: boolean("portal_enabled").notNull().default(false),
    strategyId: uuid("strategy_id"), // FK a strategies, agregada tras crear esa tabla (ver abajo)

    // Solo origen `portal` (roster de negocio + OTP):
    whatsapp: text("whatsapp"),
    website: text("website"),
    techStack: text("tech_stack"),
    services: text("services").array().notNull().default([]),
    status: text("status"), // 'Activo' | 'Inactivo' | ...
    clientValue: numeric("client_value", { precision: 12, scale: 2 }),
    assignedTo: text("assigned_to"),
    color: text("color"),
    logoUrl: text("logo_url"),
    initialNotes: text("initial_notes"),
    taskProgress: jsonb("task_progress"), // { total, completed, percentage }
    slug: text("slug"), // portal OTP — src/app/[slug]
    accessCodeHash: text("access_code_hash"),
    accessCodeExpiresAt: timestamp("access_code_expires_at", { withTimezone: true }),
    lastCodeRequestAt: timestamp("last_code_request_at", { withTimezone: true }),

    // Portal legado (`/portal`, Fase D retiro Firebase): mismo roster
    // `source='portal'` de arriba — antes autenticado con Firebase Auth por
    // `contactEmail` (== `email`), ahora con password propia. `documents`
    // reemplaza el array `documents` que vivía directo en el doc de
    // Firestore (nunca tuvo datos reales al momento de esta migración).
    legacyPasswordHash: text("legacy_password_hash"),
    // Permite desactivar el acceso sin perder la contraseña fijada (para
    // reactivar después sin pedirle a Miguel que la vuelva a escribir).
    // Unifica la creación de portal para CUALQUIER cliente (source
    // 'crm_blob' o 'portal') desde su ficha en /clientes — antes solo
    // funcionaba para source='portal' vía la página separada /portal-legado.
    legacyPortalEnabled: boolean("legacy_portal_enabled").notNull().default(false),
    // Portal de Clientes v2 (2026-07-09) — interruptor único, independiente
    // de portalEnabled/legacyPortalEnabled (sistemas viejos borrados). Único
    // campo nuevo del proyecto — ver docs/superpowers/specs/2026-07-09-portal-clientes-design.md.
    portalAccessEnabled: boolean("portal_access_enabled").notNull().default(false),
    documents: jsonb("documents").notNull().default([]), // ClientDocument[]
  },
  (t) => [
    index("clients_owner_idx").on(t.ownerId),
    uniqueIndex("clients_firestore_id_idx").on(t.firestoreId),
    uniqueIndex("clients_portal_token_idx").on(t.portalToken),
    uniqueIndex("clients_slug_idx").on(t.slug),
  ]
);

/** Actualizaciones del portal — subcolección `clients/{id}/updates` (origen `portal`). */
export const clientPortalUpdates = pgTable(
  "client_portal_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    firestoreId: text("firestore_id"),
    text: text("text").notNull(),
    imageUrl: text("image_url"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("client_portal_updates_client_idx").on(t.clientId),
    uniqueIndex("client_portal_updates_firestore_id_idx").on(t.firestoreId),
  ]
);

/**
 * Proyectos del portal — subcolección `clients/{id}/projects` (origen
 * `portal`). Distinto de `projects` (proyectos del blob `crm_data`) — el
 * portal solo guarda name/status para mostrar progreso al cliente, no
 * budget/tech/keys/tasks como el blob.
 */
export const clientPortalProjects = pgTable(
  "client_portal_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    firestoreId: text("firestore_id"),
    name: text("name").notNull(),
    status: text("status").notNull().default(""),
  },
  (t) => [
    index("client_portal_projects_client_idx").on(t.clientId),
    uniqueIndex("client_portal_projects_firestore_id_idx").on(t.firestoreId),
  ]
);

/** Solicitudes del portal OTP — colección `portal_requests` de Firestore. */
export const portalRequests = pgTable(
  "portal_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    // Firebase UID del dueño (mismo criterio de transición que infra_audit_log)
    uid: text("uid").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("recibida"),
    linkedTaskId: text("linked_task_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("portal_requests_client_idx").on(t.clientId),
    uniqueIndex("portal_requests_firestore_id_idx").on(t.firestoreId),
  ]
);

/**
 * Eventos de seguridad del portal OTP — antes `portalSecurityEvents` en
 * Firestore (TTL 90 días manual). Los eventos viejos se quedan en Firestore
 * hasta expirar; esta tabla arranca vacía.
 */
export const portalSecurityEvents = pgTable(
  "portal_security_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    slug: text("slug"),
    resolvedSlug: text("resolved_slug"),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("portal_security_events_created_idx").on(t.createdAt)]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull().default(""),
    budget: numeric("budget", { precision: 12, scale: 2 }).notNull().default("0"),
    annual: numeric("annual", { precision: 12, scale: 2 }).notNull().default("0"),
    budgetIva: ivaEnum("budget_iva").notNull().default("none"),
    annualIva: ivaEnum("annual_iva").notNull().default("none"),
    tech: text("tech").notNull().default(""),
    guides: text("guides").notNull().default(""),
    accounts: text("accounts").notNull().default(""),
    readme: text("readme").notNull().default(""),
    prompt: text("prompt").notNull().default(""),
    quickNotes: text("quick_notes").notNull().default(""),
    // Estado visible en el portal de clientes (Activo/En desarrollo/etc.)
    status: text("status").notNull().default("Activo"),
    // Contrato del que nació este proyecto (creación automática al firmar).
    // Sin FK — igual que proposals.contractId — porque `contracts` se
    // declara más abajo en este archivo.
    contractId: uuid("contract_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("projects_client_idx").on(t.clientId),
    uniqueIndex("projects_firestore_id_idx").on(t.firestoreId),
  ]
);

export const projectKeys = pgTable(
  "project_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    value: text("value").notNull(),
  },
  (t) => [
    index("project_keys_project_idx").on(t.projectId),
    uniqueIndex("project_keys_firestore_id_idx").on(t.firestoreId),
  ]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    desc: text("desc").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("pendiente"),
    prio: taskPrioEnum("prio").notNull().default("important"),
    pomoSessions: integer("pomo_sessions").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Referencia circular a work_sessions (definida más abajo en este archivo) —
    // la sesión de trabajo en la que se creó esta tarea (vía "Convertir en tarea").
    sessionId: uuid("session_id").references((): AnyPgColumn => workSessions.id, { onDelete: "set null" }),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_status_idx").on(t.status),
    uniqueIndex("tasks_firestore_id_idx").on(t.firestoreId),
    index("tasks_session_idx").on(t.sessionId),
  ]
);

export const recurringCharges = pgTable(
  "recurring_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    concept: text("concept").notNull(),
    // numeric, NO string libre — corrige el bug identificado en la auditoría
    // de seguridad ("1,500"/"$500" → NaN en los totales de src/lib/crm/next-charge-date.ts).
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    frequency: chargeFrequencyEnum("frequency").notNull(),
    startDate: date("start_date").notNull(),
    clientEmail: text("client_email").notNull(),
    active: boolean("active").notNull().default(true),
    lastNotified: timestamp("last_notified", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recurring_charges_project_idx").on(t.projectId),
    index("recurring_charges_active_idx").on(t.active),
    uniqueIndex("recurring_charges_firestore_id_idx").on(t.firestoreId),
  ]
);

export const projectLogEntries = pgTable(
  "project_log_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    category: projectLogCategoryEnum("category").notNull().default("General"),
    content: text("content").notNull(),
    // Persistido en creación — nunca recalcular (mismo contrato que hoy).
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_log_entries_project_idx").on(t.projectId),
    uniqueIndex("project_log_entries_firestore_id_idx").on(t.firestoreId),
  ]
);

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tools_owner_idx").on(t.ownerId),
    uniqueIndex("tools_firestore_id_idx").on(t.firestoreId),
  ]
);

export const knowledgeTips = pgTable(
  "knowledge_tips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tools.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("knowledge_tips_tool_idx").on(t.toolId),
    uniqueIndex("knowledge_tips_firestore_id_idx").on(t.firestoreId),
  ]
);

/**
 * Puente projectId → clientId (`ServerClientLink` en Firestore hoy).
 * Con FKs relacionales esto es en gran parte redundante (ya se navega
 * projects.clientId), pero se preserva 1:1 para no romper el contrato
 * durante la Fase 3 (migración de datos) hasta confirmar que ningún
 * consumidor depende del mapeo inverso explícito.
 */
export const serverLinks = pgTable("server_links", {
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
});

/**
 * Sesiones de trabajo (Execution Workspace). Los sub-arrays (activities,
 * notes, blockers, sessionGoals) van en JSONB: son scoped a la sesión, no
 * se consultan entre sesiones — normalizar solo si una feature futura lo
 * necesita.
 */
export const workSessions = pgTable(
  "work_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    projectName: text("project_name").notNull(),
    taskName: text("task_name").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    status: text("status").notNull().default("active"), // 'active' | 'completed'
    currentActivity: text("current_activity"),
    activities: jsonb("activities").notNull().default([]),
    notes: jsonb("notes").notNull().default([]),
    blockers: jsonb("blockers").notNull().default([]),
    sessionGoals: jsonb("session_goals").notNull().default([]),
    deployStatus: text("deploy_status"), // 'yes' | 'no' | 'na'
    commitStatus: boolean("commit_status"),
    createdBy: text("created_by").notNull(),
  },
  (t) => [
    index("work_sessions_owner_idx").on(t.ownerId),
    index("work_sessions_project_idx").on(t.projectId),
    uniqueIndex("work_sessions_firestore_id_idx").on(t.firestoreId),
  ]
);

// ── Relations (CRM core) ────────────────────────────────────────────────────

export const clientsRelations = relations(clients, ({ many, one }) => ({
  owner: one(users, { fields: [clients.ownerId], references: [users.id] }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  keys: many(projectKeys),
  tasks: many(tasks),
  charges: many(recurringCharges),
  logEntries: many(projectLogEntries),
}));

export const toolsRelations = relations(tools, ({ many, one }) => ({
  owner: one(users, { fields: [tools.ownerId], references: [users.id] }),
  tips: many(knowledgeTips),
}));

// ════════════════════════════════════════════════════════════════════════
// Documentos CRM (scoped por owner) — src/types/documents.ts
// ════════════════════════════════════════════════════════════════════════

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    reference: text("reference"),
    title: text("title").notNull(),
    scope: text("scope").notNull(),
    solution: text("solution"),
    deliverables: text("deliverables"),
    benefits: text("benefits"),
    budget: text("budget"),
    timeline: text("timeline"),
    // Conceptos de cobro opcionales (checkbox "Agregar precios" en el form).
    // Viajan al contrato como billingItemDrafts al convertir vía el wizard.
    billingItemDrafts: jsonb("billing_item_drafts").notNull().default([]),
    status: proposalStatusEnum("status").notNull().default("borrador"),
    contractId: uuid("contract_id"),
    publicToken: text("public_token"),
    viewCount: integer("view_count").notNull().default(0),
    viewEvents: jsonb("view_events").notNull().default([]), // capado a 20, igual que hoy
    currentVersion: integer("current_version").notNull().default(1),
    versions: jsonb("versions").notNull().default([]), // capado a 10, igual que hoy
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("proposals_owner_idx").on(t.ownerId),
    index("proposals_client_idx").on(t.clientId),
    uniqueIndex("proposals_public_token_idx").on(t.publicToken),
    uniqueIndex("proposals_reference_idx").on(t.reference),
    uniqueIndex("proposals_firestore_id_idx").on(t.firestoreId),
  ]
);

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    templateId: uuid("template_id"),
    version: integer("version").notNull().default(1),
    status: contractStatusEnum("status").notNull().default("borrador"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    variables: jsonb("variables").notNull().default({}),
    signers: jsonb("signers").notNull().default([]),
    pdfUrl: text("pdf_url"),
    notes: text("notes"),
    // Plantilla base fija versionada (Contratos serios — puente Propuesta →
    // Contrato → Cobro). `sections` son las cláusulas generadas/editables;
    // `content` se conserva como texto aplanado para el PDF/compat existente.
    templateVersion: integer("template_version").notNull().default(1),
    sections: jsonb("sections").notNull().default([]),
    // Conceptos de cobro definidos en el wizard, en espera de la firma. Los
    // `billingItems` reales solo se crean al firmar (ver signContract) — un
    // contrato sin firmar no debe generar cobros pendientes en Finanzas.
    billingItemDrafts: jsonb("billing_item_drafts").notNull().default([]),
    // Proyecto CRM creado automáticamente al firmar. Null hasta la firma (o
    // si la creación del proyecto falló y quedó pendiente de reintento).
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contracts_owner_idx").on(t.ownerId),
    // Corrige el IDOR identificado en la auditoría (contract-pdf/route.ts):
    // el acceso vía token de portal debe poder validar clientId, no solo owner.
    index("contracts_client_idx").on(t.clientId),
    uniqueIndex("contracts_firestore_id_idx").on(t.firestoreId),
  ]
);

export const billingItems = pgTable(
  "billing_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractId: uuid("contract_id").references(() => contracts.id, { onDelete: "set null" }),
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    concept: text("concept").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("MXN"),
    frequency: billingFrequencyEnum("frequency").notNull(),
    status: billingStatusEnum("status").notNull().default("pendiente"),
    // Vencimiento del período vivo actual. `nextDueDate` es solo el próximo
    // cobro (nunca se generan cobros futuros infinitos desde el inicio).
    dueDate: date("due_date").notNull(),
    nextDueDate: date("next_due_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("billing_items_owner_idx").on(t.ownerId),
    index("billing_items_client_idx").on(t.clientId),
    index("billing_items_contract_idx").on(t.contractId),
    index("billing_items_status_idx").on(t.status),
  ]
);

export const paymentRecords = pgTable(
  "payment_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billingItemId: uuid("billing_item_id")
      .notNull()
      .references(() => billingItems.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    paidAt: date("paid_at").notNull(),
    // Período que cubre este pago (para recurrentes) — igual al `dueDate`
    // del billing item al momento de registrar el pago.
    periodKey: date("period_key").notNull(),
    reference: text("reference"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_records_billing_item_idx").on(t.billingItemId)]
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("borrador"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    ivaRate: numeric("iva_rate", { precision: 4, scale: 3 }).notNull().default("0.16"),
    ivaAmount: numeric("iva_amount", { precision: 12, scale: 2 }).notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("MXN"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date").notNull(),
    pdfUrl: text("pdf_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoices_owner_idx").on(t.ownerId),
    index("invoices_client_idx").on(t.clientId),
    uniqueIndex("invoices_number_idx").on(t.number),
    uniqueIndex("invoices_firestore_id_idx").on(t.firestoreId),
  ]
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    qty: numeric("qty", { precision: 10, scale: 2 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)]
);

export const discoverySessions = pgTable(
  "discovery_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    industry: text("industry").notNull(),
    status: discoveryStatusEnum("status").notNull().default("generando"),
    questions: jsonb("questions").notNull().default([]),
    answers: jsonb("answers").notNull().default({}),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("discovery_sessions_owner_idx").on(t.ownerId),
    uniqueIndex("discovery_sessions_firestore_id_idx").on(t.firestoreId),
  ]
);

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    objectives: jsonb("objectives").notNull().default([]),
    kpis: jsonb("kpis").notNull().default([]),
    roadmap: jsonb("roadmap").notNull().default([]),
    priorities: text("priorities").array().notNull().default([]),
    channels: text("channels").array().notNull().default([]),
    automations: text("automations").array().notNull().default([]),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("strategies_owner_idx").on(t.ownerId),
    uniqueIndex("strategies_firestore_id_idx").on(t.firestoreId),
  ]
);

export const iaTemplates = pgTable(
  "ia_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: iaTemplateTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    content: text("content").notNull(),
    variables: text("variables").array().notNull().default([]),
    industry: text("industry"),
    isDefault: boolean("is_default").notNull().default(false),
    aiSystemPrompt: text("ai_system_prompt"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ia_templates_owner_idx").on(t.ownerId),
    uniqueIndex("ia_templates_firestore_id_idx").on(t.firestoreId),
  ]
);

// ════════════════════════════════════════════════════════════════════════
// Growth Suite — src/types/growth/*.ts (JSONB pragmático en sub-objetos
// de configuración de marca; no se consultan por campo individual hoy)
// ════════════════════════════════════════════════════════════════════════

export const growthBrands = pgTable(
  "growth_brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    identity: jsonb("identity").notNull().default({}), // BrandIdentity
    voice: jsonb("voice").notNull().default({}), // BrandVoice
    business: jsonb("business").notNull().default({}), // BrandBusiness
    positioning: jsonb("positioning").notNull().default({}), // BrandPositioning
    objections: jsonb("objections").notNull().default([]), // ObjectionResponse[]
    contentRules: jsonb("content_rules").notNull().default({}), // ContentRules
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("growth_brands_owner_idx").on(t.ownerId),
    uniqueIndex("growth_brands_firestore_id_idx").on(t.firestoreId),
  ]
);

export const growthPosts = pgTable(
  "growth_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => growthBrands.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id"), // FK a growth_campaigns, agregada abajo
    templateId: text("template_id"),
    status: postStatusEnum("status").notNull().default("draft"),
    format: text("format").notNull(),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags").array().notNull().default([]),
    imageUrl: text("image_url"),
    altText: text("alt_text"),
    suggestedTime: text("suggested_time"),
    brandSnapshot: jsonb("brand_snapshot").notNull().default({}),
    generationMetadata: jsonb("generation_metadata").notNull().default({}),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledPlatforms: jsonb("scheduled_platforms").notNull().default([]),
    publishedPlatforms: jsonb("published_platforms").notNull().default({}), // { [platform]: { publishedId, publishedUrl, publishedAt } }
    publishErrors: jsonb("publish_errors").notNull().default({}), // { [platform | 'cron']: mensaje }
    variantGroupId: uuid("variant_group_id"),
    variantIndex: integer("variant_index"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("growth_posts_owner_idx").on(t.ownerId),
    index("growth_posts_brand_idx").on(t.brandId),
    index("growth_posts_campaign_idx").on(t.campaignId),
    uniqueIndex("growth_posts_firestore_id_idx").on(t.firestoreId),
  ]
);

export const growthCampaigns = pgTable(
  "growth_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => growthBrands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    objective: text("objective").notNull(),
    targetAction: text("target_action").notNull(),
    targetPlatforms: socialPlatformEnum("target_platforms").array().notNull().default([]),
    status: campaignStatusEnum("status").notNull().default("planning"),
    strategy: jsonb("strategy"), // CampaignStrategy | null
    totalPosts: integer("total_posts").notNull().default(0),
    generatedPosts: integer("generated_posts").notNull().default(0),
    approvedPosts: integer("approved_posts").notNull().default(0),
    publishedPosts: integer("published_posts").notNull().default(0),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("growth_campaigns_owner_idx").on(t.ownerId),
    index("growth_campaigns_brand_idx").on(t.brandId),
    uniqueIndex("growth_campaigns_firestore_id_idx").on(t.firestoreId),
  ]
);

export const growthCredits = pgTable("growth_credits", {
  // Documento actual: growthCredits/{uid} → aquí, PK = ownerId (1:1)
  ownerId: uuid("owner_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  monthlyAllowance: integer("monthly_allowance").notNull().default(50),
  totalPurchased: integer("total_purchased").notNull().default(0),
  totalUsed: integer("total_used").notNull().default(0),
  lastMonthlyRefillAt: timestamp("last_monthly_refill_at", { withTimezone: true }),
  plan: organizationPlanEnum("plan").notNull().default("free"),
});

export const growthCreditLedger = pgTable(
  "growth_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: creditTransactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    balance: integer("balance").notNull(),
    operation: text("operation"),
    referenceId: text("reference_id"),
    description: text("description").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("growth_credit_ledger_owner_idx").on(t.ownerId),
    uniqueIndex("growth_credit_ledger_firestore_id_idx").on(t.firestoreId),
  ]
);

export const growthJobs = pgTable(
  "growth_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id").references(() => growthBrands.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    status: text("status").notNull().default("queued"), // JobStatus
    progress: integer("progress").notNull().default(0),
    currentStep: text("current_step"),
    resultPostId: uuid("result_post_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("growth_jobs_owner_idx").on(t.ownerId),
    uniqueIndex("growth_jobs_firestore_id_idx").on(t.firestoreId),
  ]
);

export const growthSocialAccounts = pgTable(
  "growth_social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // 'instagram' | 'facebook'
    status: socialAccountStatusEnum("status").notNull().default("connected"),
    facebookUserId: text("facebook_user_id").notNull(),
    facebookPageId: text("facebook_page_id").notNull(),
    facebookPageName: text("facebook_page_name").notNull(),
    accessToken: text("access_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
    instagramBusinessId: text("instagram_business_id"),
    instagramUsername: text("instagram_username"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("growth_social_accounts_owner_idx").on(t.ownerId),
    uniqueIndex("growth_social_accounts_firestore_id_idx").on(t.firestoreId),
  ]
);

// ════════════════════════════════════════════════════════════════════════
// Blog
// ════════════════════════════════════════════════════════════════════════

export const blogBriefs = pgTable(
  "blog_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    data: jsonb("data").notNull().default({}), // shape real: topic/angle/targetAudience/keyPoints/tone/createdBy/createdByName/generatedDraftId/status
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blog_briefs_firestore_id_idx").on(t.firestoreId)]
);

// Columnas espejo de `BlogPostSerialized` (src/lib/blog/types.ts) — el shape
// real confirmado contra datos y código en la Fase 4 (rebanada Blog).
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default([]),
    coverImage: text("cover_image"),
    author: jsonb("author").notNull().default({}), // { name, uid }
    status: text("status").notNull().default("draft"), // BlogPostStatus
    briefSource: jsonb("brief_source").notNull().default({}), // { topic, angle, targetAudience, keyPoints, tone }
    ai: jsonb("ai").notNull().default({}), // { model, generatedAt, editedByHuman, wordsAdded, iterations }
    seo: jsonb("seo").notNull().default({}), // { metaTitle, metaDescription, canonicalUrl, noindex }
    wordCount: integer("word_count").notNull().default(0),
    readingTimeMin: integer("reading_time_min").notNull().default(1),
    approvedBy: text("approved_by"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_posts_slug_idx").on(t.slug),
    uniqueIndex("blog_posts_firestore_id_idx").on(t.firestoreId),
  ]
);

// ════════════════════════════════════════════════════════════════════════
// Funnel público — src/lib/leads-repo.ts, src/lib/newsletter-repo.ts
// ════════════════════════════════════════════════════════════════════════

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    source: leadSourceEnum("source").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    message: text("message"),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
    status: leadStatusEnum("status").notNull().default("new"),
    emailDeliveryStatus: emailDeliveryStatusEnum("email_delivery_status")
      .notNull()
      .default("pending"),
    emailDeliveryAt: timestamp("email_delivery_at", { withTimezone: true }),
    emailDeliveryError: text("email_delivery_error"),
    consentTimestamp: timestamp("consent_timestamp", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // ── Diagnóstico Inteligente (source: 'diagnostic') — nullable: no aplica
    // a leads de contact_form/newsletter. Ver src/lib/diagnostic/logic.ts.
    empresa: text("empresa"),
    phone: text("phone"),
    industry: text("industry"),
    companySize: text("company_size"),
    problems: text("problems").array(),
    suggestedServices: text("suggested_services").array(),
    priority: text("priority"),
    score: integer("score"),
    answers: jsonb("answers"),
    // Botón "Quiero que me contacten" en la pantalla de resultado del
    // diagnóstico — señal explícita de intención de compra, distinta del
    // envío inicial del formulario.
    wantsContact: boolean("wants_contact").notNull().default(false),
    wantsContactAt: timestamp("wants_contact_at", { withTimezone: true }),
  },
  (t) => [
    index("leads_email_idx").on(t.email),
    index("leads_status_idx").on(t.status),
    uniqueIndex("leads_firestore_id_idx").on(t.firestoreId),
  ]
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    // Antes: doc id = hash(email). Aquí: uuid + unique index en email
    // (el hash de doc-id era para evitar duplicados, un unique index lo
    // logra igual de bien sin acoplar el id al valor).
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    status: subscriberStatusEnum("status").notNull().default("active"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull(),
    unsubscribeToken: text("unsubscribe_token").notNull(),
    reactivatedAt: timestamp("reactivated_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("newsletter_subscribers_email_idx").on(t.email),
    uniqueIndex("newsletter_subscribers_token_idx").on(t.unsubscribeToken),
  ]
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(), // `${bucket}__${hashIp}` — igual que hoy
  bucket: text("bucket").notNull(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Shape real del writer (src/lib/system-alerts.ts): severity/source/message/context.
export const systemAlerts = pgTable("system_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  severity: text("severity").notNull(), // 'info' | 'warning' | 'critical'
  source: text("source").notNull(),
  message: text("message").notNull(),
  context: jsonb("context"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authLockouts = pgTable("auth_lockouts", {
  email: text("email").primaryKey(),
  failureCount: integer("failure_count").notNull().default(0),
  firstFailureAt: timestamp("first_failure_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

// ════════════════════════════════════════════════════════════════════════
// Notificaciones / auditoría
// ════════════════════════════════════════════════════════════════════════

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    source: text("source").notNull(),
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_user_read_idx").on(t.userId, t.read),
    uniqueIndex("notifications_firestore_id_idx").on(t.firestoreId),
  ]
);

// Shape real confirmado (sin userId — feed global, no por-usuario):
// {type, message, link, timestamp}.
export const activity = pgTable(
  "activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    type: text("type").notNull(),
    message: text("message").notNull(),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("activity_firestore_id_idx").on(t.firestoreId)]
);

export const infraAuditLog = pgTable("infra_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  uid: text("uid"), // se mantiene como texto libre durante la transición (puede ser firebase uid o users.id)
  route: text("route"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Silencios del bot de infra de Telegram — antes `infraSilences` en Firestore. */
export const infraSilences = pgTable(
  "infra_silences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    silencedBy: text("silenced_by").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("infra_silences_expires_idx").on(t.expiresAt)]
);

/** Log de comandos del bot de infra — antes `infraCommandLog` en Firestore. */
export const infraCommandLog = pgTable("infra_command_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  command: text("command").notNull(),
  args: text("args"),
  chatId: text("chat_id").notNull(),
  username: text("username"),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  result: text("result").notNull(),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
});

export const cspViolations = pgTable("csp_violations", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockedUri: text("blocked_uri"),
  violatedDirective: text("violated_directive"),
  sourceFile: text("source_file"),
  lineNumber: integer("line_number"),
  documentUri: text("document_uri"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ════════════════════════════════════════════════════════════════════════
// Legacy — tasks (colección top-level de Firestore, dominio separado de
// `tasks` del CRM)
// ════════════════════════════════════════════════════════════════════════

/**
 * Colección top-level `tasks` de Firestore — datos legacy muertos (nada los
 * lee en la app; distinta de `tasks` del CRM). Shape simple confirmado
 * contra datos reales: {title, responsible, status, createdAt, dueDate}.
 * Se preserva solo como archivo histórico de la migración.
 */
export const legacyTasks = pgTable(
  "legacy_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    responsible: text("responsible"),
    status: text("status").notNull().default("pendiente"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("legacy_tasks_owner_idx").on(t.ownerId),
    uniqueIndex("legacy_tasks_firestore_id_idx").on(t.firestoreId),
  ]
);

// ════════════════════════════════════════════════════════════════════════
// Legacy — finances / tickets (src/app/portal/page.tsx los lee por
// clientName/projectName en texto libre, no por FK — se preserva igual
// aquí; 33 + 12 docs reales confirmados, no son datos de prueba).
// ════════════════════════════════════════════════════════════════════════

export const finances = pgTable(
  "finances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    clientName: text("client_name").notNull(),
    projectName: text("project_name"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    type: text("type").notNull(), // ej. 'ingreso' | 'gasto'
    status: text("status").notNull(), // 'Pagado' | 'Pendiente'
    method: text("method"),
    date: timestamp("date", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("finances_client_name_idx").on(t.clientName),
    uniqueIndex("finances_firestore_id_idx").on(t.firestoreId),
  ]
);

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firestoreId: text("firestore_id"),
    ticketId: text("ticket_id").notNull(),
    cliente: text("cliente").notNull(),
    problema: text("problema").notNull(),
    categoria: text("categoria"),
    prioridad: text("prioridad"),
    estado: text("estado").notNull().default("Abierto"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tickets_ticket_id_idx").on(t.ticketId),
    uniqueIndex("tickets_firestore_id_idx").on(t.firestoreId),
  ]
);

// ════════════════════════════════════════════════════════════════════════
// WhatsApp Inbox — contactos (Fase B, 2026-07-08). Único remanente de
// Firestore de este módulo: conversations/messages ya migraron a pixelbot
// SQLite/HTTP (src/app/api/whatsapp-inbox/*) en una sesión previa; esta
// colección (`whatsappContacts` — notas/clasificación/tags del contacto) se
// dejó fuera de scope a propósito y se migra ahora.
// ════════════════════════════════════════════════════════════════════════

export const whatsappContactClassificationEnum = pgEnum("whatsapp_contact_classification", [
  "cliente",
  "prospecto",
  "soporte",
  "proveedor",
  "spam",
  "otro",
]);

export const whatsappContactStatusEnum = pgEnum("whatsapp_contact_status", [
  "nuevo",
  "en_atencion",
  "esperando_cliente",
  "resuelto",
  "archivado",
]);

/**
 * Excepción deliberada a la convención uuid PK: `phone` es el doc id de
 * siempre en Firestore, hot-path de lookup por teléfono en cada carga del
 * inbox, y nada más lo referencia por FK salvo `whatsappContactNotes` abajo.
 *
 * `linkedClientId` es una referencia SUELTA a `clients.id` (sin FK dura a
 * propósito): el id que hoy produce `CRMContextCore.addClient()` es un id
 * generado client-side (`uid()` — timestamp base36 + random, NO un uuid) que
 * se persiste hacia Postgres de forma asíncrona/debounced (500ms) en
 * `clients.firestore_id`, mientras `clients.id` real es un uuid
 * server-generado. Un FK contra `clients.id` fallaría de formato (el valor
 * guardado aquí no es un uuid) y además hay una condición de carrera: el
 * dashboard guarda `linkedClientId` inmediatamente al convertir el contacto,
 * antes de que el insert debounced en `clients` complete. Se preserva como
 * texto libre.
 */
export const whatsappContacts = pgTable("whatsapp_contacts", {
  phone: text("phone").primaryKey(),
  name: text("name"),
  classification: whatsappContactClassificationEnum("classification"),
  tags: jsonb("tags").notNull().default([]), // string[]
  assignedTo: text("assigned_to"),
  origin: text("origin"),
  status: whatsappContactStatusEnum("status"),
  urgent: boolean("urgent").notNull().default(false),
  linkedClientId: text("linked_client_id"), // suelto, ver nota arriba — no FK
  actionHistory: jsonb("action_history").notNull().default([]), // ContactAction[]
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

/**
 * Subcolección `whatsappContacts/{phone}/notes` de Firestore. A diferencia
 * del resto de este módulo, SÍ lleva FK dura contra `whatsappContacts.phone`
 * — Firestore permitía notas bajo un doc de contacto que nunca se creó
 * explícitamente, así que `addNote()` (repo) primero garantiza una fila
 * mínima en `whatsappContacts` (INSERT ... ON CONFLICT DO NOTHING) antes de
 * insertar la nota, preservando esa capacidad sin arriesgar una FK rota.
 */
export const whatsappContactNotes = pgTable(
  "whatsapp_contact_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactPhone: text("contact_phone")
      .notNull()
      .references(() => whatsappContacts.phone, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("whatsapp_contact_notes_phone_idx").on(t.contactPhone)]
);

// ════════════════════════════════════════════════════════════════════════
// Definición de Proyecto — pipeline IA por estaciones (PM retador)
//
// Proceso guiado por IA para aterrizar una idea cruda ("descarga mental") en
// entregables sellados, ANTES de que exista como proyecto CRM. Ligado a un
// `clients`, separado de `projects` (al completar se puede convertir a
// proyecto CRM con un clic — vía el contexto CRM client-side, nunca por repo,
// para no chocar con la reconciliación de blob de crm-sync.ts).
//
// UNA mecánica (generar → aprobar/modificar → regenerar → sellar) reutilizada
// en 4 estaciones: boceto (→ Origen Note), funciones, mvp (→ MVP 1.0 +
// Congeladora), flujo. Chat de iteraciones ilimitadas => filas normalizadas
// (inserts incrementales), NO un blob jsonb que se reescribe.
// ════════════════════════════════════════════════════════════════════════

export const definitionStationEnum = pgEnum("definition_station", [
  "boceto",
  "funciones",
  "mvp",
  "flujo",
]);

export const definitionStatusEnum = pgEnum("definition_status", [
  "draft",
  "in_progress",
  "completed",
]);

export const definitionStationStatusEnum = pgEnum("definition_station_status", [
  "pending", // aún no alcanzada
  "in_progress", // estación activa
  "sealed", // aprobada/sellada (inmutable)
  "invalidated", // su sello fue anulado por reapertura upstream
]);

export const definitionMessageRoleEnum = pgEnum("definition_message_role", [
  "user",
  "assistant",
]);

export const definitionEventTypeEnum = pgEnum("definition_event_type", [
  "created",
  "started",
  "sealed",
  "reopened",
  "invalidated",
  "converted",
]);

export const projectDefinitions = pgTable(
  "project_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // Id estilo CRM (firestoreId) del cliente — necesario para operar el
    // contexto CRM client-side en la conversión final a proyecto.
    clientCrmId: text("client_crm_id").notNull(),
    title: text("title").notNull(),
    brainDump: text("brain_dump").notNull(), // la descarga mental original, inmutable
    currentStation: definitionStationEnum("current_station").notNull().default("boceto"),
    status: definitionStatusEnum("status").notNull().default("in_progress"),
    // Propuesta comercial generada al sellar las 4 estaciones (reemplaza la
    // conversión directa a proyecto). Null hasta que se genera una.
    proposalId: uuid("proposal_id").references(() => proposals.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("project_definitions_owner_idx").on(t.ownerId),
    index("project_definitions_client_idx").on(t.clientId),
  ]
);

export const definitionStations = pgTable(
  "definition_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => projectDefinitions.id, { onDelete: "cascade" }),
    station: definitionStationEnum("station").notNull(),
    status: definitionStationStatusEnum("status").notNull().default("pending"),
    currentDraft: text("current_draft"), // última propuesta de la IA (markdown)
    sealedContent: text("sealed_content"), // congelado al aprobar; NUNCA se edita
    sealedAt: timestamp("sealed_at", { withTimezone: true }),
    sealedBy: uuid("sealed_by").references(() => users.id, { onDelete: "set null" }),
    sealedByName: text("sealed_by_name"), // desnormalizado para mostrar sin join
    reopenCount: integer("reopen_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("definition_stations_def_station_idx").on(t.definitionId, t.station),
  ]
);

export const definitionMessages = pgTable(
  "definition_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => projectDefinitions.id, { onDelete: "cascade" }),
    station: definitionStationEnum("station").notNull(),
    role: definitionMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("definition_messages_def_station_idx").on(
      t.definitionId,
      t.station,
      t.createdAt
    ),
  ]
);

export const definitionEvents = pgTable(
  "definition_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => projectDefinitions.id, { onDelete: "cascade" }),
    station: definitionStationEnum("station"), // null para created/converted
    type: definitionEventTypeEnum("type").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    reason: text("reason"), // motivo de reapertura
    snapshot: text("snapshot"), // sealedContent previo al reabrir/invalidar (auditoría)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("definition_events_def_idx").on(t.definitionId, t.createdAt)]
);

export const projectDefinitionsRelations = relations(
  projectDefinitions,
  ({ many, one }) => ({
    owner: one(users, {
      fields: [projectDefinitions.ownerId],
      references: [users.id],
    }),
    client: one(clients, {
      fields: [projectDefinitions.clientId],
      references: [clients.id],
    }),
    stations: many(definitionStations),
    messages: many(definitionMessages),
    events: many(definitionEvents),
  })
);

export const definitionStationsRelations = relations(
  definitionStations,
  ({ one }) => ({
    definition: one(projectDefinitions, {
      fields: [definitionStations.definitionId],
      references: [projectDefinitions.id],
    }),
  })
);

// ════════════════════════════════════════════════════════════════════════
// Type exports
// ════════════════════════════════════════════════════════════════════════

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectKey = typeof projectKeys.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type RecurringCharge = typeof recurringCharges.$inferSelect;
export type NewRecurringCharge = typeof recurringCharges.$inferInsert;
export type ProjectLogEntry = typeof projectLogEntries.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type KnowledgeTip = typeof knowledgeTips.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;

export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type Contract = typeof contracts.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type DiscoverySession = typeof discoverySessions.$inferSelect;
export type Strategy = typeof strategies.$inferSelect;
export type IATemplate = typeof iaTemplates.$inferSelect;

export type ClientPortalUpdate = typeof clientPortalUpdates.$inferSelect;
export type ClientPortalProject = typeof clientPortalProjects.$inferSelect;

export type GrowthBrand = typeof growthBrands.$inferSelect;
export type NewGrowthBrand = typeof growthBrands.$inferInsert;
export type GrowthPost = typeof growthPosts.$inferSelect;
export type GrowthCampaign = typeof growthCampaigns.$inferSelect;
export type GrowthCredit = typeof growthCredits.$inferSelect;
export type GrowthCreditLedgerEntry = typeof growthCreditLedger.$inferSelect;
export type GrowthJob = typeof growthJobs.$inferSelect;
export type GrowthSocialAccount = typeof growthSocialAccounts.$inferSelect;

export type LegacyTask = typeof legacyTasks.$inferSelect;
export type NewLegacyTask = typeof legacyTasks.$inferInsert;
export type Finance = typeof finances.$inferSelect;
export type NewFinance = typeof finances.$inferInsert;
export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type WhatsappContactRow = typeof whatsappContacts.$inferSelect;
export type NewWhatsappContactRow = typeof whatsappContacts.$inferInsert;
export type WhatsappContactNoteRow = typeof whatsappContactNotes.$inferSelect;
export type NewWhatsappContactNoteRow = typeof whatsappContactNotes.$inferInsert;

export type ProjectDefinition = typeof projectDefinitions.$inferSelect;
export type NewProjectDefinition = typeof projectDefinitions.$inferInsert;
export type DefinitionStationRow = typeof definitionStations.$inferSelect;
export type NewDefinitionStationRow = typeof definitionStations.$inferInsert;
export type DefinitionMessage = typeof definitionMessages.$inferSelect;
export type NewDefinitionMessage = typeof definitionMessages.$inferInsert;
export type DefinitionEvent = typeof definitionEvents.$inferSelect;
export type NewDefinitionEvent = typeof definitionEvents.$inferInsert;
