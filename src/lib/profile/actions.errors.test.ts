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
  db: { update: dbUpdateMock },
}));
vi.mock("@/lib/db/schema", () => ({ users: { id: {} } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { uploadAvatar, deleteAvatar, updateProfile } from "./actions";

const TOKEN_PRIVADO = "EAAG9ZBx0kZCZBsBO1ZC7tokenprivadodemeta";
const STACK_INTERNO = "at Object.<anonymous> (/Users/pixeltec/pixeltec-os/src/lib/r2/upload.ts:88:9)";
const BUCKET_INTERNO = "pixeltec-perfil-prod";
const RAW_SQL = "UPDATE users SET image = $1 WHERE id = $2";

const MARCADORES = [TOKEN_PRIVADO, STACK_INTERNO, BUCKET_INTERNO, RAW_SQL];

function makeFormData() {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array([1, 2, 3])], "avatar.png", { type: "image/png" }));
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
      bio: "Dirección técnica",
    });

    expect(result).toEqual({ ok: false, error: "Error al guardar los cambios" });
    expect(logSerializado()).toContain("profile_update_failed");
    for (const marcador of MARCADORES) {
      expect(logSerializado()).not.toContain(marcador);
    }
  });
});
