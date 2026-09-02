import { PROTECTED_PATHS } from "./admin-routes";

/**
 * Política de acceso del rol restringido (`reviewer`, WO-2026-00051).
 *
 * Funciones PURAS (sin auth, sin DB, sin Next): reciben la forma de la
 * request y devuelven una decisión. `src/middleware.ts` las aplica con el rol
 * de la sesión; las rutas de la allowlist además releen la autoridad en
 * Postgres vía `requireWhatsAppReviewAccess` (segunda capa, independiente).
 *
 * Principio: DENY-BY-DEFAULT. Solo se permite lo que está escrito aquí; todo
 * lo demás — páginas, API routes, server actions, métodos de escritura — se
 * rechaza con 403 aunque se acceda por URL directa. Ocultar UI no sustituye
 * esto.
 */

/** Roles con acceso general (comportamiento previo al WO). */
const FULL_ACCESS_ROLES: ReadonlySet<string> = new Set(["admin", "staff"]);

/**
 * `true` si el rol NO tiene acceso general. Fail-closed a propósito: un rol
 * desconocido o ausente cae en mínimo privilegio, no en acceso total.
 */
export function isRestrictedRole(role: string | null | undefined): boolean {
  return typeof role !== "string" || !FULL_ACCESS_ROLES.has(role);
}

/** Única página interna del reviewer. Subrutas incluidas. */
export const REVIEWER_PAGE_ROOT = "/whatsapp";

/**
 * Aterrizaje por defecto tras el login (`safeInternalPath` cae en `/hoy`). Al
 * reviewer se le redirige a su única página en vez de mostrarle un 403 nada
 * más entrar. NO toca el flujo de login: es una decisión de navegación
 * posterior a la sesión.
 */
export const REVIEWER_LANDING_REDIRECT = { from: "/hoy", to: REVIEWER_PAGE_ROOT } as const;

export type HttpMethod = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiAllowRule {
  method: HttpMethod;
  /** Regex sobre el pathname completo (sin query). Anclado. */
  pattern: RegExp;
  /** Etiqueta legible (documentación / tests de contrato). */
  label: string;
}

/**
 * Allowlist EXPLÍCITA de `/api/whatsapp-inbox` para el reviewer (16 de los 25
 * handlers). Cada exclusión está justificada en docs/pr/WO-2026-00051.md:
 * las mutaciones de configuración del bot (PUT config, draft/publish/rollback)
 * y las escrituras en datos internos (contacts, notes, tickets, examples)
 * quedan fuera y conservan `requireAdmin`.
 *
 * Las tres últimas son de WO-2026-00181 y siguen el mismo criterio: solo los
 * activos de la propia cuenta de WhatsApp, nada de datos internos.
 */
export const REVIEWER_API_ALLOWLIST: readonly ApiAllowRule[] = [
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/conversations$/, label: "GET /conversations" },
  {
    method: "GET",
    pattern: /^\/api\/whatsapp-inbox\/conversations\/[^/]+\/messages$/,
    label: "GET /conversations/[phone]/messages",
  },
  { method: "POST", pattern: /^\/api\/whatsapp-inbox\/conversations\/read$/, label: "POST /conversations/read" },
  { method: "POST", pattern: /^\/api\/whatsapp-inbox\/send$/, label: "POST /send" },
  { method: "POST", pattern: /^\/api\/whatsapp-inbox\/mode$/, label: "POST /mode" },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/coexistence\/status$/, label: "GET /coexistence/status" },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/contacts$/, label: "GET /contacts" },
  {
    method: "GET",
    pattern: /^\/api\/whatsapp-inbox\/contacts\/[^/]+\/notes$/,
    label: "GET /contacts/[phone]/notes",
  },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/memory$/, label: "GET /memory" },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/config$/, label: "GET /config" },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/config\/versions$/, label: "GET /config/versions" },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/examples$/, label: "GET /examples" },
  { method: "POST", pattern: /^\/api\/whatsapp-inbox\/simulate$/, label: "POST /simulate" },
  // WO-2026-00181 — superficie de GESTIÓN de la cuenta de WhatsApp Business.
  // Meta no aprueba `whatsapp_business_management` con una declaración: exige
  // ver al revisor, dentro de la app y con su propia cuenta, leyendo los
  // activos del negocio (número, perfil, plantillas) y CREANDO una plantilla.
  // Sin estas tres reglas ese flujo termina en 403 y la revisión se rechaza.
  // Siguen siendo mínimo privilegio: tocan solo activos de la cuenta propia en
  // Graph —ni datos de clientes, ni configuración del bot— y `POST /templates`
  // es la única escritura, la que el screencast tiene que demostrar.
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/account$/, label: "GET /account" },
  { method: "GET", pattern: /^\/api\/whatsapp-inbox\/templates$/, label: "GET /templates" },
  { method: "POST", pattern: /^\/api\/whatsapp-inbox\/templates$/, label: "POST /templates" },
];

/**
 * Rutas de plataforma que el reviewer necesita para que el login/logout
 * EXISTENTE funcione: NextAuth (`/api/auth/session`, `/csrf`, `/signout`…) y
 * el receptor de reportes CSP (público, sin datos de negocio).
 */
const PLATFORM_API_PREFIXES = ["/api/auth/"] as const;
const PLATFORM_API_EXACT: readonly ApiAllowRule[] = [
  { method: "POST", pattern: /^\/api\/csp-report$/, label: "POST /api/csp-report" },
];

const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);

export interface RestrictedRequestShape {
  pathname: string;
  method: string;
  /** Header `next-action` presente ⇒ invocación de server action. */
  isServerAction: boolean;
}

export type RestrictedDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "deny"; reason: string };

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function matchesRule(rule: ApiAllowRule, pathname: string, method: string): boolean {
  return rule.method === method && rule.pattern.test(pathname);
}

/** `true` si el path+método está en la allowlist de whatsapp-inbox. */
export function isReviewerAllowedApi(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  return REVIEWER_API_ALLOWLIST.some((rule) => matchesRule(rule, pathname, m));
}

/**
 * Decisión para una sesión de rol restringido. Orden fijo — la primera regla
 * que aplica gana — y default `deny`.
 */
export function decideRestrictedAccess(req: RestrictedRequestShape): RestrictedDecision {
  const method = req.method.toUpperCase();
  const { pathname } = req;

  // 1. Server actions: cualquier action del bundle es invocable desde
  // cualquier path; el reviewer no tiene ninguna permitida.
  if (req.isServerAction) return { kind: "deny", reason: "server-action" };

  // 2. API routes: plataforma + allowlist explícita; resto denegado.
  if (pathname.startsWith("/api/")) {
    if (PLATFORM_API_PREFIXES.some((p) => pathname.startsWith(p))) return { kind: "allow" };
    if (PLATFORM_API_EXACT.some((rule) => matchesRule(rule, pathname, method))) {
      return { kind: "allow" };
    }
    if (isReviewerAllowedApi(pathname, method)) return { kind: "allow" };
    return { kind: "deny", reason: "api-not-allowlisted" };
  }

  // 3. Páginas internas: solo /whatsapp/**; /hoy redirige al aterrizaje.
  if (isProtectedPage(pathname)) {
    const inWhatsApp =
      pathname === REVIEWER_PAGE_ROOT || pathname.startsWith(`${REVIEWER_PAGE_ROOT}/`);
    if (inWhatsApp) {
      return SAFE_METHODS.has(method)
        ? { kind: "allow" }
        : { kind: "deny", reason: "page-write-method" };
    }
    if (pathname === REVIEWER_LANDING_REDIRECT.from && method === "GET") {
      return { kind: "redirect", to: REVIEWER_LANDING_REDIRECT.to };
    }
    return { kind: "deny", reason: "page-not-allowlisted" };
  }

  // 4. Fuera de lo interno (superficie pública, estáticos): solo lectura —
  // lo mismo que ve un anónimo. Cualquier escritura se rechaza.
  if (!SAFE_METHODS.has(method)) return { kind: "deny", reason: "public-write-method" };
  return { kind: "allow" };
}
