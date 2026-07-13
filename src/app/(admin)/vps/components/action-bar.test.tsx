// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

const { runVpsBackupMock, useVpsAuditMock } = vi.hoisted(() => ({
  runVpsBackupMock: vi.fn(),
  useVpsAuditMock: vi.fn(),
}));

vi.mock("@/lib/vps-swr", () => ({
  runVpsBackup: runVpsBackupMock,
  useVpsAudit: useVpsAuditMock,
}));

import { VpsActionBar } from "./action-bar";

describe("VpsActionBar", () => {
  it("runs the backup after confirming and renders the returned tail", async () => {
    runVpsBackupMock.mockResolvedValue({
      ok: true,
      durationMs: 1000,
      tail: "completado OK",
    });
    useVpsAuditMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<VpsActionBar />);

    fireEvent.click(screen.getByRole("button", { name: /Ejecutar backup/i }));

    const confirmButton = await screen.findByRole("button", {
      name: /Confirmar backup/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(runVpsBackupMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/completado OK/i)).toBeInTheDocument();
    expect(screen.getByText(/Backup completado/i)).toBeInTheDocument();
  });

  it("shows the health audit button", () => {
    useVpsAuditMock.mockReturnValue({
      data: undefined,
      error: undefined,
      isValidating: false,
      mutate: vi.fn(),
    });

    render(<VpsActionBar />);

    expect(
      screen.getByRole("button", { name: /Auditoría de salud/i })
    ).toBeInTheDocument();
  });
});
