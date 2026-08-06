import { describe, expect, test, vi, beforeEach } from "vitest";

/**
 * Saneamiento del log de `uploadAvatar` — el punto de G-04 de este archivo
 * (E0f-3a).
 *
 * Aquí el retorno al usuario ya era seguro ("Error al subir la imagen"). Lo que
 * no lo era es el registro: `console.error` recibía el `message` crudo **y** el
 * objeto `err` entero, que en un fallo de R2 arrastra la clave del bucket y la
 * URL firmada, y siempre el stack.
 */

const { authMock, uploadObjectMock, deleteObjectMock, dbUpdateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  uploadObjectMock: vi.fn(),
  deleteObjectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth/config", () => ({ auth: authMock }));
vi.mock("@/lib/r2/upload", () => ({
  uploadObject: uploadObjectMock,
  deleteObject: deleteObjectMock,
}));
vi.mock("@/lib/db", () => ({
  db: {
    update: dbUpdateMock,
    // Gate B6: requireSessionUser lee el alias de storage desde la BD (compat).
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [{ legacyUid: "fb-1" }]) })),
      })),
    })),
  },
}));
vi.mock("@/lib/db/schema", () => ({ users: { id: {} } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// C-PR1: uploadAvatar re-encodea con sharp (módulo nativo) — aquí se simula el
// pipeline para que estos tests sigan ejercitando solo el manejo de errores.
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    toFormat: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  })),
}));

import { uploadAvatar, deleteAvatar, updateProfile } from "./actions";

const TOKEN_PRIVADO = "EAAG9ZBx0kZCZBsBO1ZC7tokenprivadodemeta";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/r2/upload.ts:88:9)";
const BUCKET_INTERNO = "pixeltec-perfil-prod";
const RAW_SQL = "UPDATE users SET image = $1 WHERE id = $2";

const MARCADORES = [TOKEN_PRIVADO, STACK_INTERNO, BUCKET_INTERNO, RAW_SQL];

// C-PR1: el contenido debe llevar los magic bytes reales de PNG (89 50 4E 47)
// para pasar la validación de contenido y llegar a los caminos de error de R2.
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeFormData(bytes: Uint8Array = PNG_MAGIC, type = "image/png") {
  const fd = new FormData();
  fd.set("file", new File([bytes], "avatar.png", { type }));
  return fd;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  authMock.mockResolvedValue({ user: { id: "user-1", firebaseUid: "fb-1" } });
  deleteObjectMock.mockResolvedValue(undefined);
  dbUpdateMock.mockImplementation(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
});

/** Serializa TODO lo que llegó a console.error, incluidos objetos anidados. */
function logSerializado(): string {
  return JSON.stringify(
    errorSpy.mock.calls.map((call: unknown[]) =>
      call.map((arg: unknown) =>
        arg instanceof Error ? `${arg.message} ${arg.stack ?? ""}` : String(arg)
      )
    )
  );
}

describe("uploadAvatar — el log no lleva el error original", () => {
  test("un fallo de R2 no registra bucket, clave ni stack", async () => {
    uploadObjectMock.mockRejectedValueOnce(
      Object.assign(
        new Error(`R2 PutObject failed: bucket=${BUCKET_INTERNO} key=${TOKEN_PRIVADO}`),
        { stack: STACK_INTERNO }
      )
    );

    const result = await uploadAvatar(makeFormData());

    // El retorno ya era seguro y sigue igual.
    expect(result).toEqual({ ok: false, error: "Error al subir la imagen" });

    // Y el log sólo lleva el usuario y un código estable.
    const serializado = errorSpy.mock.calls
      .flat()
      .map((a: unknown) => String(a))
      .join(" | ");
    for (const marcador of MARCADORES) {
      expect(serializado).not.toContain(marcador);
    }
    expect(serializado).toContain("profile_upload_avatar_failed");
    expect(serializado).toContain("user-1");
  });

  test("el objeto de error no se pasa como argumento al logger", async () => {
    const err = new Error(`bucket=${BUCKET_INTERNO}`);
    uploadObjectMock.mockRejectedValueOnce(err);

    await uploadAvatar(makeFormData());

    // Antes se pasaba `err` como cuarto argumento: el logger lo expandía entero.
    for (const call of errorSpy.mock.calls) {
      expect(call).not.toContain(err);
    }
  });

  test("un error de otra clase tampoco revela su texto en el log", async () => {
    uploadObjectMock.mockRejectedValueOnce(
      Object.assign(new Error("null value violates not-null constraint"), {
        name: "PostgresError",
        query: RAW_SQL,
      })
    );

    const result = await uploadAvatar(makeFormData());

    expect(result).toEqual({ ok: false, error: "Error al subir la imagen" });
    const serializado = errorSpy.mock.calls
      .flat()
      .map((a: unknown) => String(a))
      .join(" | ");
    expect(serializado).not.toContain(RAW_SQL);
    expect(serializado).not.toContain("not-null constraint");
  });

  test("sin sesión el mensaje propio se conserva", async () => {
    authMock.mockResolvedValueOnce(null);

    const result = await uploadAvatar(makeFormData());

    expect(result).toEqual({ ok: false, error: "No autenticado" });
  });

  // C-PR1: el contenido real debe coincidir con el `file.type` declarado.
  test("magic bytes: contenido JPEG declarado como PNG se rechaza sin tocar R2", async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const result = await uploadAvatar(makeFormData(jpegBytes, "image/png"));

    expect(result).toEqual({
      ok: false,
      error: "El archivo no corresponde al formato declarado.",
    });
    expect(uploadObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

/** E0f-3b: los dos catch restantes del archivo dejan de registrar el objeto original. */
describe("deleteAvatar — el log no lleva el error original", () => {
  test("un fallo de la BD registra sólo el código estable; el retorno público no cambia", async () => {
    dbUpdateMock.mockImplementationOnce(() => {
      throw Object.assign(new Error(`update falló: ${RAW_SQL}`), {
        name: "PostgresError",
        query: RAW_SQL,
        stack: STACK_INTERNO,
      });
    });

    const result = await deleteAvatar();

    expect(result).toEqual({ ok: false, error: "Error al eliminar la foto" });
    expect(logSerializado()).toContain("profile_delete_avatar_failed");
    for (const marcador of MARCADORES) {
      expect(logSerializado()).not.toContain(marcador);
    }
  });
});

describe("updateProfile — el log no lleva el error original", () => {
  test("un fallo de la BD registra sólo el código estable; el retorno público no cambia", async () => {
    dbUpdateMock.mockImplementationOnce(() => {
      throw Object.assign(new Error(`update falló: ${RAW_SQL}`), {
        name: "PostgresError",
        stack: STACK_INTERNO,
      });
    });

    const result = await updateProfile({
      displayName: "Miguel Robles",
      phone: "+523221112233",
      jobTitle: "Dirección técnica",
    });

    expect(result).toEqual({ ok: false, error: "Error al guardar los cambios" });
    expect(logSerializado()).toContain("profile_update_failed");
    for (const marcador of MARCADORES) {
      expect(logSerializado()).not.toContain(marcador);
    }
  });
});
