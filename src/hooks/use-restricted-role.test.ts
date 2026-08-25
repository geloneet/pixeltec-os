// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { useUserProfileMock } = vi.hoisted(() => ({ useUserProfileMock: vi.fn() }));
vi.mock("@/hooks/use-user-profile", () => ({ useUserProfile: useUserProfileMock }));

import { useIsRestrictedRole } from "./use-restricted-role";

beforeEach(() => useUserProfileMock.mockReset());

describe("useIsRestrictedRole (WO-2026-00055)", () => {
  it("sesión cargando → undefined (no se decide nada)", () => {
    useUserProfileMock.mockReturnValue({ userProfile: null, loading: true });
    expect(renderHook(() => useIsRestrictedRole()).result.current).toBeUndefined();
  });

  it("sin perfil (sin sesión) → undefined", () => {
    useUserProfileMock.mockReturnValue({ userProfile: null, loading: false });
    expect(renderHook(() => useIsRestrictedRole()).result.current).toBeUndefined();
  });

  it("reviewer → true; rol desconocido/ausente → true (misma regla que el middleware)", () => {
    for (const role of ["reviewer", "superadmin", undefined]) {
      useUserProfileMock.mockReturnValue({ userProfile: { uid: "u", role }, loading: false });
      expect(renderHook(() => useIsRestrictedRole()).result.current, String(role)).toBe(true);
    }
  });

  it("admin y staff → false", () => {
    for (const role of ["admin", "staff"]) {
      useUserProfileMock.mockReturnValue({ userProfile: { uid: "u", role }, loading: false });
      expect(renderHook(() => useIsRestrictedRole()).result.current, role).toBe(false);
    }
  });
});
