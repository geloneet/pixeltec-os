// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import useSWR from "swr";
import { RestrictedShellBoundary } from "./restricted-shell-boundary";

const { useUserProfileMock } = vi.hoisted(() => ({ useUserProfileMock: vi.fn() }));
vi.mock("@/hooks/use-user-profile", () => ({ useUserProfile: useUserProfileMock }));

/** Consumidor SWR equivalente al poller de /api/vps/status de la paleta ⌘K. */
function Poller({ fetcher }: { fetcher: (url: string) => Promise<unknown> }) {
  const { data } = useSWR("/api/vps/status", fetcher, { dedupingInterval: 0 });
  return <div data-testid="poller">{data ? "con datos" : "sin datos"}</div>;
}

const tick = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => useUserProfileMock.mockReset());
afterEach(() => cleanup());

describe("RestrictedShellBoundary (WO-2026-00055)", () => {
  it("reviewer: el poller SWR NO hace fetch (ni siquiera la primera carga)", async () => {
    useUserProfileMock.mockReturnValue({ userProfile: { uid: "u", role: "reviewer" }, loading: false });
    const fetcher = vi.fn(async () => ({ projects: [] }));
    const { getByTestId } = render(
      <RestrictedShellBoundary>
        <Poller fetcher={fetcher} />
      </RestrictedShellBoundary>
    );
    await tick();
    expect(fetcher).not.toHaveBeenCalled();
    expect(getByTestId("poller").textContent).toBe("sin datos");
  });

  it.each(["admin", "staff"])("%s: el poller SWR sigue haciendo fetch como hoy", async (role) => {
    useUserProfileMock.mockReturnValue({ userProfile: { uid: "u", role }, loading: false });
    const fetcher = vi.fn(async () => ({ projects: [] }));
    const { getByTestId } = render(
      <RestrictedShellBoundary>
        <Poller fetcher={fetcher} />
      </RestrictedShellBoundary>
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/vps/status"));
    await waitFor(() => expect(getByTestId("poller").textContent).toBe("con datos"));
  });
});
