// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

/**
 * WO-2026-00055: con rol restringido (reviewer) la campana no consulta nada —
 * las server actions de notificaciones devuelven 403 en el middleware y
 * generaban «useNotifications error» en consola. Admin y staff: igual que hoy.
 */
const { actions, useUserProfileMock } = vi.hoisted(() => ({
  actions: {
    getMyNotifications: vi.fn(),
    markNotificationReadAction: vi.fn(),
    markAllNotificationsReadAction: vi.fn(),
  },
  useUserProfileMock: vi.fn(),
}));
vi.mock("@/lib/notifications/actions", () => actions);
vi.mock("@/hooks/use-user-profile", () => ({ useUserProfile: useUserProfileMock }));

import { useNotifications } from "./use-notifications";

const NOTIF = { id: "n1", read: false, title: "t", body: "b", href: null, createdAt: "2026-08-25T00:00:00Z", readAt: null };

beforeEach(() => {
  actions.getMyNotifications.mockReset().mockResolvedValue([NOTIF]);
  actions.markNotificationReadAction.mockReset().mockResolvedValue(undefined);
  actions.markAllNotificationsReadAction.mockReset().mockResolvedValue(undefined);
  useUserProfileMock.mockReset();
});
afterEach(() => vi.useRealTimers());

function withRole(role: string) {
  useUserProfileMock.mockReturnValue({ userProfile: { uid: "u", role }, loading: false });
}

describe("useNotifications — rol restringido", () => {
  it("reviewer: no invoca ninguna action; lista vacía, sin error, loading=false", async () => {
    withRole("reviewer");
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(actions.getMyNotifications).not.toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.markAsRead("n1");
      await result.current.markAllAsRead();
    });
    expect(actions.markNotificationReadAction).not.toHaveBeenCalled();
    expect(actions.markAllNotificationsReadAction).not.toHaveBeenCalled();
  });

  it("sesión cargando: no consulta todavía", async () => {
    useUserProfileMock.mockReturnValue({ userProfile: null, loading: true });
    renderHook(() => useNotifications());
    await new Promise((r) => setTimeout(r, 20));
    expect(actions.getMyNotifications).not.toHaveBeenCalled();
  });

  it.each(["admin", "staff"])("%s: consulta como hoy y marca leído", async (role) => {
    withRole(role);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(actions.getMyNotifications).toHaveBeenCalledWith(20);
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await result.current.markAsRead("n1");
    });
    expect(actions.markNotificationReadAction).toHaveBeenCalledWith("n1");
  });
});
