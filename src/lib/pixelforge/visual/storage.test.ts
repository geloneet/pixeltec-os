import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadObjectMock, deleteObjectMock } = vi.hoisted(() => ({
  uploadObjectMock: vi.fn(),
  deleteObjectMock: vi.fn(),
}));

vi.mock("@/lib/r2/upload", () => ({
  uploadObject: uploadObjectMock,
  deleteObject: deleteObjectMock,
}));

import { uploadReferenceImage } from "./storage";

const UID = "user-1";
const PROJECT_ID = "project-1";
const REFERENCE_ID = "ref-1";

describe("uploadReferenceImage", () => {
  beforeEach(() => {
    uploadObjectMock.mockReset();
    deleteObjectMock.mockReset();
    uploadObjectMock.mockResolvedValue("https://cdn.example.com/pixelforge/user-1/project-1/references/ref-1.png");
    deleteObjectMock.mockResolvedValue(undefined);
  });

  it("rechaza un mime type fuera de la whitelist (gif)", async () => {
    const buffer = Buffer.from("fake-gif-bytes");
    await expect(
      uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, buffer, "image/gif")
    ).rejects.toThrow("Formato de imagen no permitido");
    expect(uploadObjectMock).not.toHaveBeenCalled();
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("rechaza un buffer que excede 5MB", async () => {
    const buffer = Buffer.alloc(6 * 1024 * 1024);
    await expect(
      uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, buffer, "image/png")
    ).rejects.toThrow("La imagen excede 5MB");
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  it("acepta exactamente 5MB (el límite es estricto '> 5MB', no '>=')", async () => {
    const buffer = Buffer.alloc(5 * 1024 * 1024);
    await expect(
      uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, buffer, "image/png")
    ).resolves.toBeDefined();
  });

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
  ])("sube %s con la key pixelforge/.../references/<id>.%s", async (mimeType, ext) => {
    const buffer = Buffer.from("bytes");
    const result = await uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, buffer, mimeType);

    const expectedKey = `pixelforge/${UID}/${PROJECT_ID}/references/${REFERENCE_ID}.${ext}`;
    expect(result.key).toBe(expectedKey);
    expect(uploadObjectMock).toHaveBeenCalledWith(expectedKey, buffer, mimeType);
  });

  it("borra las 3 extensiones posibles antes de subir (limpieza de versiones previas)", async () => {
    const buffer = Buffer.from("bytes");
    await uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, buffer, "image/webp");

    expect(deleteObjectMock).toHaveBeenCalledTimes(3);
    expect(deleteObjectMock).toHaveBeenCalledWith(
      `pixelforge/${UID}/${PROJECT_ID}/references/${REFERENCE_ID}.png`
    );
    expect(deleteObjectMock).toHaveBeenCalledWith(
      `pixelforge/${UID}/${PROJECT_ID}/references/${REFERENCE_ID}.jpg`
    );
    expect(deleteObjectMock).toHaveBeenCalledWith(
      `pixelforge/${UID}/${PROJECT_ID}/references/${REFERENCE_ID}.webp`
    );
  });

  it("borra las versiones previas ANTES de subir la nueva (orden de llamadas)", async () => {
    const calls: string[] = [];
    deleteObjectMock.mockImplementation(async () => {
      calls.push("delete");
    });
    uploadObjectMock.mockImplementation(async () => {
      calls.push("upload");
      return "https://cdn.example.com/x.png";
    });

    await uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, Buffer.from("bytes"), "image/png");

    expect(calls).toEqual(["delete", "delete", "delete", "upload"]);
  });

  it("no borra ni sube nada si la validación falla (mime o tamaño)", async () => {
    await expect(
      uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, Buffer.alloc(6 * 1024 * 1024), "image/png")
    ).rejects.toThrow();
    expect(deleteObjectMock).not.toHaveBeenCalled();
    expect(uploadObjectMock).not.toHaveBeenCalled();
  });

  it("devuelve { url, key } de la subida", async () => {
    uploadObjectMock.mockResolvedValue("https://cdn.example.com/pixelforge/user-1/project-1/references/ref-1.png");
    const result = await uploadReferenceImage(UID, PROJECT_ID, REFERENCE_ID, Buffer.from("bytes"), "image/png");

    expect(result).toEqual({
      url: "https://cdn.example.com/pixelforge/user-1/project-1/references/ref-1.png",
      key: `pixelforge/${UID}/${PROJECT_ID}/references/${REFERENCE_ID}.png`,
    });
  });
});
