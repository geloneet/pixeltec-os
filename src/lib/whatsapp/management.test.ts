import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EgressBlockedError } from "@/lib/egress-guard";
import { TemplateValidationError } from "./template-builder";
import {
  ManagementError,
  createMessageTemplate,
  getBusinessProfile,
  getManagementConfig,
  getPhoneNumberInfo,
  listMessageTemplates,
} from "./management";

/**
 * Cliente de gestión de WhatsApp Business con `fetch` STUBBEADO: cero llamadas
 * reales a Meta. Verifica la URL exacta de cada lectura, el saneamiento de los
 * errores de Graph, el timeout, la política de egress y —lo que más importa—
 * que el token no aparece en ninguna respuesta, error ni log.
 */

const TOKEN = "EAAG-token-de-prueba-no-real-9999";

const ENV = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_GRAPH_BASE_URL",
  "EGRESS_WHATSAPP_MODE",
  "EGRESS_WHATSAPP_ALLOWLIST",
  "EGRESS_DEFAULT_MODE",
  "EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION",
] as const;

const original: Record<string, string | undefined> = {};
let fetchMock: ReturnType<typeof vi.fn>;

function respuesta(json: unknown, init?: { status?: number; ok?: boolean }): Response {
  const status = init?.status ?? 200;
  return {
    status,
    ok: init?.ok ?? (status >= 200 && status < 300),
    type: "default",
    headers: { get: () => null },
    json: async () => json,
  } as unknown as Response;
}

function urlDeLaLlamada(indice = 0): string {
  return String(fetchMock.mock.calls[indice][0]);
}

function initDeLaLlamada(indice = 0): RequestInit {
  return fetchMock.mock.calls[indice][1] as RequestInit;
}

beforeEach(() => {
  for (const k of ENV) {
    original[k] = process.env[k];
    delete process.env[k];
  }
  process.env.WHATSAPP_ACCESS_TOKEN = TOKEN;
  process.env.WHATSAPP_PHONE_NUMBER_ID = "111222333444";
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "999888777666";
  // El canal solo autoriza destinatarios de mensajes; la gestión no tiene
  // destinatario, así que `allowlist` con una lista ajena debe dejarla pasar.
  process.env.EGRESS_WHATSAPP_MODE = "allowlist";
  process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5213221234567";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const k of ENV) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe("getManagementConfig", () => {
  test("configurado: ids y versión, y NUNCA el token", () => {
    const config = getManagementConfig();
    expect(config).toEqual({
      configured: true,
      phoneNumberId: "111222333444",
      businessAccountId: "999888777666",
      apiVersion: "v21.0",
    });
    expect(JSON.stringify(config)).not.toContain(TOKEN);
  });

  test("respeta WHATSAPP_API_VERSION", () => {
    process.env.WHATSAPP_API_VERSION = "v23.0";
    expect(getManagementConfig()).toMatchObject({ apiVersion: "v23.0" });
  });

  test("no configurado: lista EXACTA de lo que falta, sin lanzar", () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    expect(getManagementConfig()).toEqual({
      configured: false,
      missing: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID"],
    });
  });

  test("una env vacía o de solo espacios cuenta como ausente", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "   ";
    expect(getManagementConfig()).toEqual({
      configured: false,
      missing: ["WHATSAPP_PHONE_NUMBER_ID"],
    });
  });
});

describe("getPhoneNumberInfo", () => {
  test("GET a la URL exacta, con Bearer, redirect manual y timeout", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta({
        id: "111222333444",
        display_phone_number: "+52 1 322 137 8336",
        verified_name: "PixelTEC",
        quality_rating: "GREEN",
        name_status: "APPROVED",
        code_verification_status: "VERIFIED",
        messaging_limit_tier: "TIER_1K",
        platform_type: "CLOUD_API",
      })
    );

    const info = await getPhoneNumberInfo();

    expect(urlDeLaLlamada()).toBe(
      "https://graph.facebook.com/v21.0/111222333444" +
        "?fields=display_phone_number,verified_name,quality_rating,name_status," +
        "code_verification_status,messaging_limit_tier,platform_type"
    );
    const init = initDeLaLlamada();
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeDefined();
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);

    expect(info).toEqual({
      id: "111222333444",
      displayPhoneNumber: "+52 1 322 137 8336",
      verifiedName: "PixelTEC",
      qualityRating: "GREEN",
      nameStatus: "APPROVED",
      codeVerificationStatus: "VERIFIED",
      messagingLimitTier: "TIER_1K",
      platformType: "CLOUD_API",
    });
  });

  test("campos ausentes salen como null, no como undefined", async () => {
    fetchMock.mockResolvedValueOnce(respuesta({ display_phone_number: "+52 1 322 137 8336" }));
    const info = await getPhoneNumberInfo();
    expect(info).toEqual({
      id: "111222333444",
      displayPhoneNumber: "+52 1 322 137 8336",
      verifiedName: null,
      qualityRating: null,
      nameStatus: null,
      codeVerificationStatus: null,
      messagingLimitTier: null,
      platformType: null,
    });
  });
});

describe("getBusinessProfile", () => {
  test("desenvuelve `data[0]` y normaliza websites", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta({
        data: [
          {
            about: "Software a la medida",
            address: "Puerto Vallarta",
            description: "Agencia",
            email: "hola@pixeltec.mx",
            profile_picture_url: "https://example.invalid/p.jpg",
            websites: ["https://pixeltec.mx"],
            vertical: "PROF_SERVICES",
          },
        ],
      })
    );

    const perfil = await getBusinessProfile();

    expect(urlDeLaLlamada()).toBe(
      "https://graph.facebook.com/v21.0/111222333444/whatsapp_business_profile" +
        "?fields=about,address,description,email,profile_picture_url,websites,vertical"
    );
    expect(perfil).toEqual({
      about: "Software a la medida",
      address: "Puerto Vallarta",
      description: "Agencia",
      email: "hola@pixeltec.mx",
      profilePictureUrl: "https://example.invalid/p.jpg",
      websites: ["https://pixeltec.mx"],
      vertical: "PROF_SERVICES",
    });
  });

  test("`data` vacío: perfil en blanco, no un error", async () => {
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    expect(await getBusinessProfile()).toEqual({
      about: null,
      address: null,
      description: null,
      email: null,
      profilePictureUrl: null,
      websites: [],
      vertical: null,
    });
  });
});

describe("listMessageTemplates", () => {
  test("URL con fields + limit=50 y mapeo de componentes", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta({
        data: [
          {
            id: "1001",
            name: "pedido_listo",
            language: "es_MX",
            status: "APPROVED",
            category: "UTILITY",
            components: [
              { type: "BODY", text: "Hola {{1}}", example: { body_text: [["Miguel"]] } },
              { type: "FOOTER", text: "PixelTEC" },
            ],
            quality_score: { score: "GREEN" },
          },
        ],
      })
    );

    const plantillas = await listMessageTemplates();

    expect(urlDeLaLlamada()).toBe(
      "https://graph.facebook.com/v21.0/999888777666/message_templates" +
        "?fields=id,name,language,status,category,components,rejected_reason,quality_score&limit=50"
    );
    expect(plantillas).toEqual([
      {
        id: "1001",
        name: "pedido_listo",
        language: "es_MX",
        status: "APPROVED",
        category: "UTILITY",
        components: [
          { type: "BODY", format: null, text: "Hola {{1}}" },
          { type: "FOOTER", format: null, text: "PixelTEC" },
        ],
        rejectedReason: null,
        qualityScore: "GREEN",
      },
    ]);
  });

  test("respuesta sin `data`: lista vacía", async () => {
    fetchMock.mockResolvedValueOnce(respuesta({}));
    expect(await listMessageTemplates()).toEqual([]);
  });
});

describe("createMessageTemplate", () => {
  const INPUT = {
    name: "pedido_listo",
    language: "es_MX",
    category: "UTILITY",
    body: "Hola {{1}}, tu pedido está listo.",
    examples: ["Miguel"],
  };

  test("POST al WABA con el payload del builder", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta({ id: "2002", status: "PENDING", category: "UTILITY" }, { status: 200 })
    );

    const creada = await createMessageTemplate(INPUT);

    expect(urlDeLaLlamada()).toBe(
      "https://graph.facebook.com/v21.0/999888777666/message_templates"
    );
    const init = initDeLaLlamada();
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("manual");
    expect(JSON.parse(String(init.body))).toEqual({
      name: "pedido_listo",
      language: "es_MX",
      category: "UTILITY",
      components: [
        {
          type: "BODY",
          text: "Hola {{1}}, tu pedido está listo.",
          example: { body_text: [["Miguel"]] },
        },
      ],
    });
    expect(creada).toEqual({ id: "2002", status: "PENDING", name: "pedido_listo" });
  });

  test("sin `status` en la respuesta se asume PENDING", async () => {
    fetchMock.mockResolvedValueOnce(respuesta({ id: "2003" }));
    expect(await createMessageTemplate(INPUT)).toEqual({
      id: "2003",
      status: "PENDING",
      name: "pedido_listo",
    });
  });

  test("entrada inválida: TemplateValidationError SIN tocar la red", async () => {
    await expect(createMessageTemplate({ ...INPUT, name: "MAL" })).rejects.toBeInstanceOf(
      TemplateValidationError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("errores de Graph saneados", () => {
  test("usa error_user_msg + code y NO vuelca el cuerpo completo", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(
        {
          error: {
            message: "(#100) Invalid parameter",
            error_user_msg: "El nombre de la plantilla ya existe.",
            code: 100,
            error_subcode: 2388043,
            fbtrace_id: "AbCdEf",
            error_data: { details: "interno de Meta" },
          },
        },
        { status: 400 }
      )
    );

    const err = await createMessageTemplate({
      name: "pedido_listo",
      language: "es_MX",
      category: "UTILITY",
      body: "Hola.",
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ManagementError);
    const managementError = err as ManagementError;
    expect(managementError.status).toBe(400);
    expect(managementError.code).toBe(100);
    expect(managementError.message).toContain("El nombre de la plantilla ya existe.");
    expect(managementError.message).not.toContain("error_data");
    expect(managementError.message).not.toContain("interno de Meta");
    expect(managementError.message).not.toContain("AbCdEf");
  });

  test("sin error_user_msg cae a error.message", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta({ error: { message: "Unsupported get request.", code: 803 } }, { status: 404 })
    );
    const err = (await getPhoneNumberInfo().catch((e: unknown) => e)) as ManagementError;
    expect(err.status).toBe(404);
    expect(err.code).toBe(803);
    expect(err.message).toContain("Unsupported get request.");
  });

  test("sin cuerpo interpretable: mensaje genérico con el status", async () => {
    fetchMock.mockResolvedValueOnce(respuesta({}, { status: 500 }));
    const err = (await getPhoneNumberInfo().catch((e: unknown) => e)) as ManagementError;
    expect(err.status).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err.message).toContain("500");
  });

  test("el TOKEN nunca aparece en el error aunque Meta lo devuelva", async () => {
    fetchMock.mockResolvedValueOnce(
      respuesta(
        { error: { message: `Invalid OAuth access token: ${TOKEN}`, code: 190 } },
        { status: 401 }
      )
    );
    const err = (await listMessageTemplates().catch((e: unknown) => e)) as ManagementError;
    expect(err.message).not.toContain(TOKEN);
    expect(err.message).toContain("***");
  });

  test("un 3xx no se sigue", async () => {
    fetchMock.mockResolvedValueOnce(respuesta({}, { status: 302, ok: false }));
    const err = (await getPhoneNumberInfo().catch((e: unknown) => e)) as ManagementError;
    expect(err).toBeInstanceOf(ManagementError);
    expect(err.status).toBe(502);
  });

  test("timeout: 504 y sin filtrar el destino", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    const err = (await getPhoneNumberInfo().catch((e: unknown) => e)) as ManagementError;
    expect(err).toBeInstanceOf(ManagementError);
    expect(err.status).toBe(504);
    expect(err.message).not.toContain(TOKEN);
  });

  test("fallo de red: 502 sin el mensaje de undici", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed to graph.facebook.com:443"));
    const err = (await getPhoneNumberInfo().catch((e: unknown) => e)) as ManagementError;
    expect(err.status).toBe(502);
    expect(err.message).not.toContain("graph.facebook.com:443");
  });

  test("no configurado: ManagementError 503, sin red", async () => {
    delete process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const err = (await listMessageTemplates().catch((e: unknown) => e)) as ManagementError;
    expect(err).toBeInstanceOf(ManagementError);
    expect(err.status).toBe(503);
    expect(err.message).toContain("WHATSAPP_BUSINESS_ACCOUNT_ID");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("egress-guard", () => {
  test("canal whatsapp `disabled`: la lectura se bloquea igual que un envío", async () => {
    process.env.EGRESS_WHATSAPP_MODE = "disabled";
    await expect(getPhoneNumberInfo()).rejects.toBeInstanceOf(EgressBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("canal whatsapp `disabled`: la creación también", async () => {
    process.env.EGRESS_WHATSAPP_MODE = "disabled";
    await expect(
      createMessageTemplate({
        name: "pedido_listo",
        language: "es_MX",
        category: "UTILITY",
        body: "Hola.",
      })
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("modo inválido bloquea (fail-closed)", async () => {
    process.env.EGRESS_WHATSAPP_MODE = "sí";
    await expect(getPhoneNumberInfo()).rejects.toBeInstanceOf(EgressBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("`live` fuera de producción sin el flag bloquea", async () => {
    process.env.EGRESS_WHATSAPP_MODE = "live";
    await expect(getPhoneNumberInfo()).rejects.toBeInstanceOf(EgressBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("`allowlist` de destinatarios NO bloquea una lectura de gestión", async () => {
    process.env.EGRESS_WHATSAPP_ALLOWLIST = "+5219999999999";
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    await expect(listMessageTemplates()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("WHATSAPP_GRAPH_BASE_URL (mock local del smoke)", () => {
  test("loopback fuera de producción: se usa", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WHATSAPP_GRAPH_BASE_URL = "http://127.0.0.1:9099";
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    await listMessageTemplates();
    expect(urlDeLaLlamada()).toBe(
      "http://127.0.0.1:9099/v21.0/999888777666/message_templates" +
        "?fields=id,name,language,status,category,components,rejected_reason,quality_score&limit=50"
    );
  });

  test("localhost con ruta: solo se conserva el origen", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WHATSAPP_GRAPH_BASE_URL = "http://localhost:9099/ignorada/";
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    await listMessageTemplates();
    expect(urlDeLaLlamada()).toContain("http://localhost:9099/v21.0/");
    expect(urlDeLaLlamada()).not.toContain("ignorada");
  });

  test("en producción se ignora aunque sea loopback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WHATSAPP_GRAPH_BASE_URL = "http://127.0.0.1:9099";
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    await listMessageTemplates();
    expect(urlDeLaLlamada()).toContain("https://graph.facebook.com/v21.0/");
  });

  test("host que no es loopback se ignora", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WHATSAPP_GRAPH_BASE_URL = "https://evil.example.invalid";
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    await listMessageTemplates();
    expect(urlDeLaLlamada()).toContain("https://graph.facebook.com/v21.0/");
  });

  test("URL malformada se ignora", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.WHATSAPP_GRAPH_BASE_URL = "no-es-una-url";
    fetchMock.mockResolvedValueOnce(respuesta({ data: [] }));
    await listMessageTemplates();
    expect(urlDeLaLlamada()).toContain("https://graph.facebook.com/v21.0/");
  });
});
