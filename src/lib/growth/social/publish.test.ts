import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Saneamiento de `growthPosts.publishErrors` en escritura (E0f-3b).
 *
 * El catch de `publishRowToAccount` persiste en la columna jsonb Y devuelve el
 * mismo texto al POST de publish (que lo sirve al toast de la UI). Antes
 * guardaba `err.message` — un fallo de Drizzle citaba SQL; uno de red, su
 * cuerpo. Ahora solo cruza el mensaje público fijo; el detalle queda en el log
 * del servidor como `name`, nunca como texto libre.
 */

const { dbUpdateMock, setMock, whereMock } = vi.hoisted(() => {
  const whereMock = vi.fn(async () => undefined);
  const setMock = vi.fn(() => ({ where: whereMock }));
  const dbUpdateMock = vi.fn(() => ({ set: setMock }));
  return { dbUpdateMock, setMock, whereMock };
});

const metaApi = vi.hoisted(() => ({
  createInstagramMediaContainer: vi.fn(),
  publishInstagramMedia: vi.fn(),
  publishFacebookPost: vi.fn(),
}));

const pgHelpers = vi.hoisted(() => ({
  resolveOwnerId: vi.fn(async () => "owner-1"),
  resolvePostRow: vi.fn(),
  resolveSocialAccountRow: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { update: dbUpdateMock, select: vi.fn() } }));
vi.mock("@/lib/db/schema", () => ({ growthPosts: {}, growthSocialAccounts: {} }));
vi.mock("./meta-api", () => metaApi);
vi.mock("../pg", () => pgHelpers);

import { publishPostToAccount } from "./publish";
import { PUBLISH_FAILED_MESSAGE } from "./publish-errors";

const PROVIDER_BODY = '{"error":{"message":"Invalid OAuth access token EAAG9ZBx0kZC","type":"OAuthException"}}';
const RAW_SQL = 'update "growth_posts" set "status" = $1 where "growth_posts"."id" = $2';
const TOKEN_PRIVADO = "EAAG9ZBx0kZCZBsBO1ZC7tokenprivadodemeta";
const MARCADORES = [PROVIDER_BODY, RAW_SQL, TOKEN_PRIVADO];

function postRow() {
  return {
    id: "post-1",
    ownerId: "owner-1",
    caption: "Lanzamiento",
    hashtags: [],
    imageUrl: "https://cdn.pixeltec.mx/post.png",
    publishedPlatforms: {},
    publishErrors: {},
  };
}

function facebookAccount() {
  return {
    id: "acc-1",
    ownerId: "owner-1",
    platform: "facebook",
    accessToken: TOKEN_PRIVADO,
    facebookPageId: "page-1",
    instagramBusinessId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  pgHelpers.resolveOwnerId.mockResolvedValue("owner-1");
  pgHelpers.resolvePostRow.mockResolvedValue(postRow());
  pgHelpers.resolveSocialAccountRow.mockResolvedValue(facebookAccount());
});

/** Todo lo que se habría escrito vía `db.update(...).set(...)`. */
function persistido(): string {
  return JSON.stringify(setMock.mock.calls);
}

describe("publishRowToAccount — publishErrors y el retorno no llevan texto crudo", () => {
  test("PROVIDER_BODY del proveedor no entra: se persiste y devuelve el mensaje fijo", async () => {
    metaApi.publishFacebookPost.mockRejectedValueOnce(new Error(PROVIDER_BODY));

    const result = await publishPostToAccount("post-1", "acc-1", "uid-1");

    expect(result).toEqual({ ok: false, platform: "facebook", error: PUBLISH_FAILED_MESSAGE });
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        publishErrors: { facebook: PUBLISH_FAILED_MESSAGE },
      })
    );
    for (const marcador of MARCADORES) {
      expect(persistido()).not.toContain(marcador);
    }
  });

  test("RAW_SQL de un fallo de Drizzle tampoco entra", async () => {
    metaApi.publishFacebookPost.mockRejectedValueOnce(
      Object.assign(new Error(`syntax error at or near: ${RAW_SQL}`), { name: "PostgresError" })
    );

    const result = await publishPostToAccount("post-1", "acc-1", "uid-1");

    expect(result).toEqual({ ok: false, platform: "facebook", error: PUBLISH_FAILED_MESSAGE });
    expect(persistido()).not.toContain(RAW_SQL);
  });

  test("el éxito queda intacto: status published, publishedUrl y estado por plataforma", async () => {
    metaApi.publishFacebookPost.mockResolvedValueOnce("fb-123");

    const result = await publishPostToAccount("post-1", "acc-1", "uid-1");

    expect(result).toMatchObject({
      ok: true,
      platform: "facebook",
      publishedId: "fb-123",
      publishedUrl: "https://www.facebook.com/fb-123",
    });
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
    expect(whereMock).toHaveBeenCalled();
  });
});
