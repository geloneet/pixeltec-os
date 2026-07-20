// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

// Este archivo no usa `globals: true` de Vitest (ver `vitest.config.ts`), así
// que el auto-cleanup de Testing Library no se dispara solo entre los `it()`
// de este archivo (mismo patrón que `layout.test.tsx`).
afterEach(() => cleanup());

// `page.tsx` es un Server Component: llama `auth()` (next-auth) y a
// `listPixelforgeProjectsByOwner` (Drizzle). Bajo Vitest no hay request
// context real de Next ni conexión a DB, así que mockeamos ambos límites,
// igual que `actions.test.ts` / `route.test.ts` mockean `@/lib/auth/config`.
vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "owner-1" } }),
}));

const listPixelforgeProjectsByOwnerMock = vi.fn();
vi.mock("@/lib/db/repos/pixelforge", () => ({
  listPixelforgeProjectsByOwner: (...args: unknown[]) =>
    listPixelforgeProjectsByOwnerMock(...args),
}));

// `redirect()` de `next/navigation` depende del request context de Next
// (throw especial `NEXT_REDIRECT`) que no existe bajo Vitest — no se debería
// disparar en el camino feliz (con `ownerId`), pero lo mockeamos para no
// arrastrar el módulo real si algún día cambia el orden de checks.
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import PixelforgeListPage from "./page";

const BASE_PROJECT = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Landing Acme",
  clientId: "client-1",
  clientName: "Acme Corp",
  createdAt: new Date("2026-07-01T00:00:00Z"),
  updatedAt: new Date("2026-07-19T00:00:00Z"),
};

describe("PixelforgeListPage", () => {
  it("no duplica el nombre de la estación en una fila `in_progress` (ya viene embebido en el badge)", async () => {
    listPixelforgeProjectsByOwnerMock.mockResolvedValue([
      {
        ...BASE_PROJECT,
        status: "in_progress",
        currentStation: "estrategia",
      },
    ]);

    render(await PixelforgeListPage());

    const row = screen.getByText("Landing Acme").closest("a");
    expect(row).not.toBeNull();
    // "Estrategia" debe aparecer UNA sola vez en la fila: dentro del badge
    // `ForgeStationBadge` (que ya la embebe para `in_progress`), NO también
    // como span de metadata suelto al lado del cliente.
    expect(within(row as HTMLElement).getAllByText("Estrategia")).toHaveLength(1);
  });

  it("sigue mostrando la estación como metadata para proyectos draft/approved/completed (sin regresión)", async () => {
    listPixelforgeProjectsByOwnerMock.mockResolvedValue([
      {
        ...BASE_PROJECT,
        id: "22222222-2222-2222-2222-222222222222",
        title: "Landing Draft",
        status: "draft",
        currentStation: "contexto",
      },
      {
        ...BASE_PROJECT,
        id: "33333333-3333-3333-3333-333333333333",
        title: "Landing Aprobada",
        status: "approved",
        currentStation: "visual",
      },
      {
        ...BASE_PROJECT,
        id: "44444444-4444-4444-4444-444444444444",
        title: "Landing Completa",
        status: "completed",
        currentStation: "qa",
      },
    ]);

    render(await PixelforgeListPage());

    const draftRow = screen.getByText("Landing Draft").closest("a");
    const approvedRow = screen.getByText("Landing Aprobada").closest("a");
    const completedRow = screen.getByText("Landing Completa").closest("a");

    expect(within(draftRow as HTMLElement).getAllByText("Contexto")).toHaveLength(1);
    expect(within(approvedRow as HTMLElement).getAllByText("Visual")).toHaveLength(1);
    expect(within(completedRow as HTMLElement).getAllByText("QA")).toHaveLength(1);
  });
});
