// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { SymptomReport } from "./symptom-report";
import type { VpsAuditReport } from "@/lib/vps-types";

function buildReport(): VpsAuditReport {
  return {
    symptoms: [
      {
        id: "yellow-1",
        severity: "yellow",
        area: "Certificados",
        message: "Certificado expira en 10 días",
        suggestedAction: "Renovar certbot",
        evidence: null,
      },
      {
        id: "red-1",
        severity: "red",
        area: "Disco",
        message: "Disco al 90%",
        suggestedAction: "Limpiar Docker…",
        evidence: null,
      },
    ],
    summary: { red: 1, yellow: 1, green: 3 },
    generatedAt: new Date().toISOString(),
  };
}

describe("SymptomReport", () => {
  it("renders red symptoms before yellow ones, counts, and suggested actions", () => {
    render(<SymptomReport report={buildReport()} />);

    const messages = screen
      .getAllByText(/Disco al 90%|Certificado expira en 10 días/)
      .map((el) => el.textContent);

    const redIndex = messages.findIndex((m) => m?.includes("Disco al 90%"));
    const yellowIndex = messages.findIndex((m) =>
      m?.includes("Certificado expira en 10 días")
    );

    expect(redIndex).toBeGreaterThanOrEqual(0);
    expect(yellowIndex).toBeGreaterThan(redIndex);

    expect(screen.getByText("1 críticos")).toBeInTheDocument();
    expect(screen.getByText("1 alertas")).toBeInTheDocument();
    expect(screen.getByText("3 ok")).toBeInTheDocument();

    expect(screen.getByText("Limpiar Docker…")).toBeInTheDocument();
    expect(screen.getByText("Renovar certbot")).toBeInTheDocument();
  });

  it("renders the empty state when there are no symptoms", () => {
    render(
      <SymptomReport
        report={{
          symptoms: [],
          summary: { red: 0, yellow: 0, green: 0 },
          generatedAt: new Date().toISOString(),
        }}
      />
    );

    expect(screen.getByText("Sin datos de auditoría")).toBeInTheDocument();
  });
});
