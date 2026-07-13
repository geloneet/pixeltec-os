// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { HealthPanels } from "./health-panels";
import type { VpsSnapshot } from "@/lib/vps-types";

function buildSnapshot(): VpsSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    disk: { size: "100G", used: "80G", avail: "20G", usedPct: 80 },
    host: {
      ramUsedPct: 60,
      load1: 1.2,
      nproc: 4,
      crashLoops: [{ name: "pixelbot-worker", restarts: 91179 }],
    },
    services: [
      { id: "svc-1", name: "crm", domain: "crm.pixeltec.mx", status: "running", httpOk: true, httpCode: 200 },
    ],
    certs: [
      { domain: "api.pixeltec.mx", expiresAt: new Date().toISOString(), daysLeft: 5 },
    ],
    databases: [
      { name: "crm_prod", size: "2.1G", lastBackupAgeHrs: null },
    ],
    backups: {
      ok: false,
      lastRunAgeHrs: 40,
      coverageMissing: ["crm_prod"],
      offsite: false,
    },
    security: {
      securityUpdates: 3,
      publicPortsOutOfPolicy: [8080],
      sshPassword: true,
      secretsInLogs: ["modar_bot"],
    },
  };
}

describe("HealthPanels", () => {
  it("renders all seven panels with known-bad states surfaced", () => {
    render(<HealthPanels snapshot={buildSnapshot()} />);

    // 1. Bases de datos — never-backed-up DB (name also appears as a
    // coverage-missing chip in the Backups panel, so expect 2 matches)
    expect(screen.getAllByText("crm_prod").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("nunca respaldada")).toBeInTheDocument();

    // 2. Certificados TLS — expiring soon
    expect(screen.getByText("api.pixeltec.mx")).toBeInTheDocument();
    expect(screen.getByText("5d restantes")).toBeInTheDocument();

    // 3. Backups — offsite gap
    expect(screen.getByText("sin offsite")).toBeInTheDocument();

    // 4. Seguridad — secret in logs, out-of-policy port, SSH password, updates count
    expect(screen.getByText("token en logs: modar_bot")).toBeInTheDocument();
    expect(screen.getByText("puerto 8080 fuera de política")).toBeInTheDocument();
    expect(screen.getByText("SSH: password activo")).toBeInTheDocument();
    expect(screen.getByText("3 actualizaciones de seguridad")).toBeInTheDocument();

    // 5. Recursos — RAM usage (disk is intentionally not duplicated here;
    // ServerStatsHeader owns disk display elsewhere on the page)
    expect(screen.getByText("60%")).toBeInTheDocument();

    // 6. Salud del host — crash loop
    expect(screen.getByText("91179 reinicios")).toBeInTheDocument();

    // 7. Servicios (salud HTTP) — healthy service with domain
    expect(screen.getByText("crm.pixeltec.mx")).toBeInTheDocument();
    expect(screen.getByText("HTTP 200")).toBeInTheDocument();
  });

  it("renders a red HTTP badge for a service failing its health check", () => {
    const snapshot = buildSnapshot();
    snapshot.services = [
      {
        id: "svc-2",
        name: "broken",
        domain: "x.mx",
        status: "running",
        httpOk: false,
        httpCode: 500,
      },
    ];

    render(<HealthPanels snapshot={snapshot} />);

    expect(screen.getByText("x.mx")).toBeInTheDocument();
    const badge = screen.getByText("HTTP 500");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/red/);
  });

  it("renders empty states gracefully when arrays are empty", () => {
    const snapshot = buildSnapshot();
    snapshot.databases = [];
    snapshot.certs = [];
    snapshot.host.crashLoops = [];
    snapshot.security.publicPortsOutOfPolicy = [];
    snapshot.security.secretsInLogs = [];
    snapshot.backups.coverageMissing = [];

    render(<HealthPanels snapshot={snapshot} />);

    expect(screen.getByText("sin bases de datos")).toBeInTheDocument();
    expect(screen.getByText("sin certificados")).toBeInTheDocument();
    expect(screen.getByText("sin crash-loops")).toBeInTheDocument();
    expect(screen.getByText("completa")).toBeInTheDocument();
  });
});
