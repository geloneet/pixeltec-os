import { assertMetaEgressAllowed, type MetaOperation, type MetaTarget } from "@/lib/egress-guard";

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Mismo criterio que pixelbot-client.ts (15s): sin esto, una conexión retenida
// por Meta cuelga el callback OAuth o la publicación hasta el timeout del host.
const META_TIMEOUT_MS = 15_000;

/**
 * Frontera única hacia la Graph API de Meta.
 *
 * Antes había diez `fetch` sueltos, seis de ellos con credenciales en la query
 * string (`client_secret`, `access_token`, el app token completo). Eso obligaba
 * a construir URLs con secretos *antes* de saber si la operación estaba
 * autorizada, y los errores volcaban el cuerpo crudo de la respuesta.
 *
 * `buildRequest` es una fábrica diferida a propósito: la guarda corre primero y,
 * si bloquea, **los parámetros sensibles nunca llegan a construirse**. El orden
 * es política → autorización de identidad → parámetros → URL → red.
 *
 * `path` es siempre relativo al BASE fijo: no se aceptan hosts arbitrarios.
 */
async function metaFetch(input: {
  operation: MetaOperation;
  target: MetaTarget;
  buildRequest: () => { path: string; init?: RequestInit };
}): Promise<Response> {
  assertMetaEgressAllowed({ operation: input.operation, target: input.target });

  const { path, init } = input.buildRequest();

  // Seis de estos flujos llevan la credencial en la query string, así que un
  // redirect no solo reenviaría cabeceras: reenviaría la URL entera con el
  // token dentro. No se sigue ninguno.
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(META_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(`META_API_ERROR: ${input.operation} timed out after ${META_TIMEOUT_MS}ms`);
    }
    // Error de red sin cuerpo de respuesta: no hay datos sensibles que sanear,
    // pero se normaliza al mismo formato para no filtrar detalles del runtime.
    throw new Error(`META_API_ERROR: ${input.operation} network failure`);
  }

  // Se corta antes de que ningún llamador lea la respuesta. Importa porque
  // `getInstagramUsername` devuelve '' ante `!res.ok`: sin esto, un redirect
  // se confundiría con «la cuenta no tiene usuario».
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw metaError(input.operation, res.status);
  }

  return res;
}

/**
 * Error de Meta sin datos sensibles.
 *
 * Conserva lo accionable —operación y código HTTP— y descarta el cuerpo crudo,
 * que puede contener eco de tokens, del código OAuth o del texto publicado.
 */
function metaError(operation: MetaOperation, status: number): Error {
  return new Error(`META_API_ERROR: ${operation} failed with HTTP ${status}`);
}

/** Identidad de la aplicación, usada como destino cuando aún no hay cuenta. */
function appTarget(): MetaTarget {
  return { kind: "app", id: process.env.META_APP_ID ?? "" };
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
}> {
  const res = await metaFetch({
    operation: "token_exchange",
    target: appTarget(),
    buildRequest: () => {
      const params = new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
      });
      return { path: `/oauth/access_token?${params}` };
    },
  });
  if (!res.ok) throw metaError("token_exchange", res.status);
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in?: number }>;
}

export async function getLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await metaFetch({
    operation: "token_exchange",
    target: appTarget(),
    buildRequest: () => {
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: shortLivedToken,
      });
      return { path: `/oauth/access_token?${params}` };
    },
  });
  if (!res.ok) throw metaError("token_exchange", res.status);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ─── Facebook user & pages ────────────────────────────────────────────────────

export async function getFacebookUser(token: string): Promise<{ id: string; name: string }> {
  const res = await metaFetch({
    operation: "read",
    target: appTarget(),
    buildRequest: () => ({ path: `/me?fields=id,name&access_token=${token}` }),
  });
  if (!res.ok) throw metaError("read", res.status);
  return res.json() as Promise<{ id: string; name: string }>;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

/**
 * Devuelve tokens de página en la respuesta, así que se clasifica como
 * `credential_read` y no como lectura simple: entrega credenciales.
 */
export async function getFacebookPages(userToken: string): Promise<FacebookPage[]> {
  const res = await metaFetch({
    operation: "credential_read",
    target: appTarget(),
    buildRequest: () => ({
      path: `/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`,
    }),
  });
  if (!res.ok) throw metaError("credential_read", res.status);
  const data = (await res.json()) as { data: FacebookPage[] };
  return data.data ?? [];
}

export async function getInstagramUsername(igBusinessId: string, pageToken: string): Promise<string> {
  const res = await metaFetch({
    operation: "read",
    target: { kind: "account", id: igBusinessId },
    buildRequest: () => ({ path: `/${igBusinessId}?fields=username&access_token=${pageToken}` }),
  });
  // Contrato conservado: devuelve cadena vacía en vez de lanzar.
  if (!res.ok) return '';
  const data = (await res.json()) as { username?: string };
  return data.username ?? '';
}

// ─── Instagram Publishing ─────────────────────────────────────────────────────

export async function createInstagramMediaContainer(
  igUserId: string,
  pageToken: string,
  caption: string,
  imageUrl: string
): Promise<string> {
  const res = await metaFetch({
    operation: "create_media",
    target: { kind: "account", id: igUserId },
    buildRequest: () => {
      const params = new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: pageToken,
      });
      return { path: `/${igUserId}/media`, init: { method: 'POST', body: params } };
    },
  });
  if (!res.ok) throw metaError("create_media", res.status);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function publishInstagramMedia(
  igUserId: string,
  pageToken: string,
  creationId: string
): Promise<string> {
  const res = await metaFetch({
    operation: "publish",
    target: { kind: "account", id: igUserId },
    buildRequest: () => {
      const params = new URLSearchParams({
        creation_id: creationId,
        access_token: pageToken,
      });
      return { path: `/${igUserId}/media_publish`, init: { method: 'POST', body: params } };
    },
  });
  if (!res.ok) throw metaError("publish", res.status);
  const data = (await res.json()) as { id: string };
  return data.id;
}

// ─── Facebook Publishing ──────────────────────────────────────────────────────

export async function publishFacebookPost(
  pageId: string,
  pageToken: string,
  message: string,
  imageUrl?: string
): Promise<string> {
  // Las dos ramas son operaciones lógicas distintas contra endpoints distintos,
  // pero comparten riesgo: ambas publican en una página real.
  const res = await metaFetch({
    operation: "publish",
    target: { kind: "account", id: pageId },
    buildRequest: () => {
      const body = new URLSearchParams({ access_token: pageToken });
      if (imageUrl) {
        body.set('url', imageUrl);
        body.set('caption', message);
        return { path: `/${pageId}/photos`, init: { method: 'POST', body } };
      }
      body.set('message', message);
      return { path: `/${pageId}/feed`, init: { method: 'POST', body } };
    },
  });
  if (!res.ok) throw metaError("publish", res.status);
  const data = (await res.json()) as { id: string };
  return data.id;
}

// ─── Token validation ─────────────────────────────────────────────────────────

export async function debugToken(token: string): Promise<{ is_valid: boolean; expires_at?: number }> {
  const res = await metaFetch({
    operation: "read",
    target: appTarget(),
    buildRequest: () => {
      const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
      return { path: `/debug_token?input_token=${token}&access_token=${appToken}` };
    },
  });
  // Contrato conservado: no lanza, informa token inválido.
  if (!res.ok) return { is_valid: false };
  const data = (await res.json()) as { data: { is_valid: boolean; expires_at?: number } };
  return data.data;
}
