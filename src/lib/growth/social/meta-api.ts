const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// ─── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error(`Meta token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in?: number }>;
}

export async function getLongLivedToken(shortLivedToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(`${BASE}/oauth/access_token?${params}`);
  if (!res.ok) throw new Error(`Long-lived token exchange failed: ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

// ─── Facebook user & pages ────────────────────────────────────────────────────

export async function getFacebookUser(token: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${BASE}/me?fields=id,name&access_token=${token}`);
  if (!res.ok) throw new Error(`Failed to get FB user: ${await res.text()}`);
  return res.json() as Promise<{ id: string; name: string }>;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function getFacebookPages(userToken: string): Promise<FacebookPage[]> {
  const res = await fetch(
    `${BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`
  );
  if (!res.ok) throw new Error(`Failed to get FB pages: ${await res.text()}`);
  const data = (await res.json()) as { data: FacebookPage[] };
  return data.data ?? [];
}

export async function getInstagramUsername(igBusinessId: string, pageToken: string): Promise<string> {
  const res = await fetch(
    `${BASE}/${igBusinessId}?fields=username&access_token=${pageToken}`
  );
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
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: pageToken,
  });
  const res = await fetch(`${BASE}/${igUserId}/media`, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) throw new Error(`IG media container failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function publishInstagramMedia(
  igUserId: string,
  pageToken: string,
  creationId: string
): Promise<string> {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: pageToken,
  });
  const res = await fetch(`${BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) throw new Error(`IG publish failed: ${await res.text()}`);
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
  const body = new URLSearchParams({ access_token: pageToken });

  if (imageUrl) {
    // Post with photo
    body.set('url', imageUrl);
    body.set('caption', message);
    const res = await fetch(`${BASE}/${pageId}/photos`, { method: 'POST', body });
    if (!res.ok) throw new Error(`FB photo post failed: ${await res.text()}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  } else {
    // Text-only post
    body.set('message', message);
    const res = await fetch(`${BASE}/${pageId}/feed`, { method: 'POST', body });
    if (!res.ok) throw new Error(`FB feed post failed: ${await res.text()}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  }
}

// ─── Token validation ─────────────────────────────────────────────────────────

export async function debugToken(token: string): Promise<{ is_valid: boolean; expires_at?: number }> {
  const appToken = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
  const res = await fetch(
    `${BASE}/debug_token?input_token=${token}&access_token=${appToken}`
  );
  if (!res.ok) return { is_valid: false };
  const data = (await res.json()) as { data: { is_valid: boolean; expires_at?: number } };
  return data.data;
}
