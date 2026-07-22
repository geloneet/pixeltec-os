// @vitest-environment jsdom
// src/components/pixelforge/ReviewStationPanel.test.tsx
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { QaFindingView, QaRunView } from "./QaStationPanel";
import type {
  ReviewCommentView,
  ReviewEventView,
  ReviewTreeNodeView,
  ReviewView,
} from "./ReviewStationPanel";

// El Select de radix (PF-X1 T3) mide/desplaza el item activo al abrir — jsdom
// no implementa `scrollIntoView` (mismo stub que `QaStationPanel.test.tsx`).
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { ReviewStationPanel } from "./ReviewStationPanel";

function currentPageVersionFixture(overrides: Partial<{ id: string; version: number; createdByName: string; createdAt: string }> = {}) {
  return {
    id: "ver-2",
    version: 2,
    notas: "",
    warnings: [] as string[],
    createdByName: "Ana",
    createdAt: "2026-07-18T10:00:00.000Z",
    ...overrides,
  };
}

function runFixture(overrides: Partial<QaRunView> = {}): QaRunView {
  return {
    id: "run-1",
    pageVersionId: "ver-2",
    pageVersionNumber: 2,
    status: "succeeded",
    progress: 100,
    currentPhase: "cierre",
    verdict: "pass",
    scoreTotal: 92,
    categoryScores: null,
    catalogVersion: "1",
    scoringVersion: "1",
    humanDecision: null,
    humanDecisionByName: null,
    humanDecisionAt: null,
    humanDecisionReason: null,
    error: null,
    createdAt: "2026-07-18T12:00:00.000Z",
    finishedAt: "2026-07-18T12:05:00.000Z",
    ...overrides,
  };
}

function findingFixture(overrides: Partial<QaFindingView> = {}): QaFindingView {
  return {
    id: "f-1",
    checkCode: "QA-VI-002",
    category: "visual",
    severity: "major",
    blocking: false,
    source: "nav",
    title: "Overflow horizontal en el hero",
    description: "La sección 'hero' desborda 12px en móvil.",
    recommendation: "Revisa el contenido de la sección afectada.",
    evidence: null,
    location: null,
    locationKey: "QA-VI-002|-|-|-",
    ...overrides,
  };
}

function reviewFixture(overrides: Partial<ReviewView> = {}): ReviewView {
  return {
    id: "rev-1",
    pageVersionId: "ver-2",
    qaRunId: "run-1",
    roundNumber: 1,
    status: "in_review",
    verdictSnapshot: "pass_with_warnings",
    scoreSnapshot: 80,
    targetStation: null,
    requestReason: null,
    acceptedRisks: null,
    approvedByName: null,
    approvedAt: null,
    approvalReason: null,
    openedByName: "Ana",
    createdAt: "2026-07-19T09:00:00.000Z",
    closedAt: null,
    ...overrides,
  };
}

function commentFixture(overrides: Partial<ReviewCommentView> = {}): ReviewCommentView {
  return {
    id: "com-1",
    reviewId: "rev-1",
    anchorType: "general",
    nodeId: null,
    findingId: null,
    body: "Revisa el copy del hero",
    blocking: false,
    status: "open",
    authorName: "Miguel",
    createdAt: "2026-07-19T10:00:00.000Z",
    resolvedByName: null,
    resolvedAt: null,
    resolutionReason: null,
    ...overrides,
  };
}

function eventFixture(overrides: Partial<ReviewEventView> = {}): ReviewEventView {
  return {
    id: "ev-1",
    type: "review_opened",
    actorName: "Ana",
    reason: null,
    createdAt: "2026-07-19T09:00:00.000Z",
    ...overrides,
  };
}

const treeNodes: ReviewTreeNodeView[] = [
  { nodeId: "hero-1", componentId: "hero", orden: 1 },
  { nodeId: "cta-1", componentId: "cta-band", orden: 2 },
];

interface RenderOverrides {
  currentPageVersion?: ReturnType<typeof currentPageVersionFixture> | null;
  runs?: QaRunView[];
  reviews?: ReviewView[];
  comments?: ReviewCommentView[];
  anchoredRunFindings?: QaFindingView[];
  treeNodes?: ReviewTreeNodeView[];
  events?: ReviewEventView[];
  needsReanchor?: boolean;
}

function renderPanel(overrides: RenderOverrides = {}) {
  const props = {
    projectId: "proj-1",
    currentPageVersion: currentPageVersionFixture(),
    runs: [runFixture()],
    reviews: [] as ReviewView[],
    comments: [] as ReviewCommentView[],
    anchoredRunFindings: [] as QaFindingView[],
    treeNodes,
    events: [] as ReviewEventView[],
    needsReanchor: false,
    ...overrides,
  };
  return render(<ReviewStationPanel {...props} />);
}

describe("ReviewStationPanel — banner por stage (9 estados)", () => {
  it("draft: sin currentPageVersion", () => {
    renderPanel({ currentPageVersion: null });
    expect(screen.getByText(/aún no hay versión compuesta/i)).toBeInTheDocument();
  });

  it("awaiting_qa: vigente sin QA cerrado", () => {
    renderPanel({ runs: [], reviews: [] });
    expect(screen.getByText(/la versión vigente espera su temple/i)).toBeInTheDocument();
  });

  it("qa_failed: el QA cerrado de la vigente falló", () => {
    renderPanel({ runs: [runFixture({ verdict: "fail" })], reviews: [] });
    expect(screen.getByText(/no se puede abrir revisión/i)).toBeInTheDocument();
  });

  it("ready_for_review: gate abierto sin review", () => {
    renderPanel({ runs: [runFixture({ verdict: "pass" })], reviews: [] });
    expect(screen.getByRole("button", { name: /abrir revisión/i })).toBeInTheDocument();
  });

  it("in_review: ronda abierta", () => {
    renderPanel({
      runs: [runFixture({ verdict: "pass" })],
      reviews: [reviewFixture({ status: "in_review", roundNumber: 3, openedByName: "Miguel" })],
    });
    expect(screen.getByText(/ronda 3 abierta por miguel/i)).toBeInTheDocument();
  });

  it("changes_requested: muestra estación destino y razón", () => {
    renderPanel({
      reviews: [
        reviewFixture({
          status: "changes_requested",
          targetStation: "produccion",
          requestReason: "Corrige el hero",
        }),
      ],
    });
    expect(screen.getByText(/producción/i)).toBeInTheDocument();
    expect(screen.getByText(/corrige el hero/i)).toBeInTheDocument();
  });

  it("approved + releaseReady: muestra ForgeStamp + RELEASE-READY", () => {
    renderPanel({
      reviews: [
        reviewFixture({
          status: "approved",
          approvedByName: "Ana",
          approvedAt: "2026-07-21T09:00:00.000Z",
          approvalReason: "Se ve bien",
        }),
      ],
    });
    expect(screen.getByText(/release-ready/i)).toBeInTheDocument();
    expect(screen.getByText(/aprobada por ana/i)).toBeInTheDocument();
    expect(screen.getByText(/sellado/i)).toBeInTheDocument();
  });

  it("superseded: nota de aprobación superseded", () => {
    renderPanel({
      currentPageVersion: currentPageVersionFixture({ version: 2 }),
      runs: [],
      reviews: [
        reviewFixture({
          status: "superseded",
          pageVersionId: "ver-1",
          roundNumber: 1,
          approvedAt: "2026-07-18T09:00:00.000Z",
        }),
      ],
    });
    expect(screen.getByText(/quedó superseded/i)).toBeInTheDocument();
  });

  it("cancelled: nota neutral con razón", () => {
    renderPanel({
      runs: [],
      reviews: [
        reviewFixture({ status: "cancelled", roundNumber: 2, requestReason: "Ya no aplica" }),
      ],
    });
    expect(screen.getByText(/ronda 2 cancelada/i)).toBeInTheDocument();
    expect(screen.getByText(/ya no aplica/i)).toBeInTheDocument();
  });
});

describe("ReviewStationPanel — cabecera", () => {
  it("muestra verdict/score/conteos del run anclado", () => {
    renderPanel({
      runs: [runFixture({ verdict: "pass_with_warnings" })],
      reviews: [reviewFixture({ verdictSnapshot: "pass_with_warnings", scoreSnapshot: 77 })],
      anchoredRunFindings: [
        findingFixture({ id: "f-crit", severity: "critical", blocking: true }),
        findingFixture({ id: "f-major", severity: "major" }),
        findingFixture({ id: "f-minor", severity: "minor" }),
      ],
    });
    expect(screen.getByText(/templada con reservas/i)).toBeInTheDocument();
    expect(screen.getByText("77")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    const previewLink = screen.getByRole("link", { name: /abrir preview/i });
    expect(previewLink).toHaveAttribute("href", "/proyectos/pixelforge/proj-1/preview");
    expect(previewLink).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /ver qa completo/i })).toHaveAttribute(
      "href",
      "/proyectos/pixelforge/proj-1/qa"
    );
  });
});

describe("ReviewStationPanel — abrir revisión", () => {
  it("postea el body exacto y refresca", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, review: {} }) });
    renderPanel({ runs: [runFixture({ verdict: "pass" })], reviews: [] });

    fireEvent.click(screen.getByRole("button", { name: /abrir revisión/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pixelforge/reviews",
        expect.objectContaining({ method: "POST" })
      )
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ projectId: "proj-1" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});

describe("ReviewStationPanel — needsReanchor", () => {
  it("muestra banner y postea reanchor", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    renderPanel({
      runs: [runFixture({ verdict: "pass" })],
      reviews: [reviewFixture({ status: "in_review" })],
      needsReanchor: true,
    });

    const button = screen.getByRole("button", { name: /re-anclar/i });
    fireEvent.click(button);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pixelforge/reviews/rev-1/reanchor",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});

describe("ReviewStationPanel — comentarios", () => {
  const comments: ReviewCommentView[] = [
    commentFixture({ id: "c-open-blocking", blocking: true, status: "open", body: "Bloqueante abierto" }),
    commentFixture({ id: "c-open", blocking: false, status: "open", body: "Comentario abierto" }),
    commentFixture({
      id: "c-resolved",
      status: "resolved",
      body: "Comentario resuelto",
      resolvedByName: "Ana",
      resolvedAt: "2026-07-19T11:00:00.000Z",
      resolutionReason: "Ya se corrigió",
    }),
  ];

  function renderInReview(extra: RenderOverrides = {}) {
    renderPanel({
      runs: [runFixture({ verdict: "pass_with_warnings" })],
      reviews: [reviewFixture({ status: "in_review", verdictSnapshot: "pass" })],
      comments,
      ...extra,
    });
  }

  it("filtra por estado y por ancla", () => {
    renderInReview();
    // "Bloqueante abierto" aparece 2 veces (lista de comentarios + banner de
    // bloqueantes en la zona de decisión, sección F) — ambas son intencionales.
    expect(screen.getAllByText("Bloqueante abierto").length).toBe(2);
    expect(screen.getByText("Comentario abierto")).toBeInTheDocument();
    expect(screen.getByText("Comentario resuelto")).toBeInTheDocument();

    // Des-marcar "Abierto" oculta los dos abiertos de la LISTA (el banner de
    // bloqueantes en la zona de decisión no depende de este filtro — sigue
    // mostrando la verdad del servidor).
    fireEvent.click(screen.getByRole("button", { name: /filtrar estado abierto/i }));
    expect(screen.getAllByText("Bloqueante abierto").length).toBe(1);
    expect(screen.queryByText("Comentario abierto")).not.toBeInTheDocument();
    expect(screen.getByText("Comentario resuelto")).toBeInTheDocument();
  });

  it("los blocking-open aparecen primero y deshabilitan Solicitar cambios / Aprobar", () => {
    renderInReview();
    const items = screen.getAllByText(/^(Bloqueante abierto|Comentario abierto|Comentario resuelto)$/);
    expect(items[0]).toHaveTextContent("Bloqueante abierto");

    expect(screen.getByRole("button", { name: /solicitar cambios/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeDisabled();
    expect(screen.getAllByText(/bloqueante abierto/i).length).toBeGreaterThan(0);
  });

  it("alta de comentario solo visible en in_review y postea con ancla de sección", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, comment: {} }) });
    renderInReview({ comments: [] });

    fireEvent.click(screen.getByRole("combobox", { name: /ancla del comentario/i }));
    fireEvent.click(await screen.findByRole("option", { name: /sección/i }));

    fireEvent.click(screen.getByRole("combobox", { name: /nodo/i }));
    fireEvent.click(await screen.findByRole("option", { name: /hero · orden 1/i }));

    fireEvent.change(screen.getByPlaceholderText(/escribe tu comentario/i), {
      target: { value: "Ajustar el hero" },
    });

    fireEvent.click(screen.getByRole("button", { name: /agregar comentario/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pixelforge/reviews/rev-1/comments",
        expect.objectContaining({ method: "POST" })
      )
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      anchorType: "section",
      nodeId: "hero-1",
      body: "Ajustar el hero",
      blocking: false,
    });
  });
});

describe("ReviewStationPanel — checklist de riesgos al aprobar", () => {
  const majors = [
    findingFixture({ id: "f-major-1", severity: "major", checkCode: "QA-VI-001" }),
    findingFixture({ id: "f-major-2", severity: "major", checkCode: "QA-VI-002" }),
  ];

  function renderPendingApprove() {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    renderPanel({
      runs: [runFixture({ verdict: "pass_with_warnings" })],
      reviews: [
        reviewFixture({ status: "in_review", verdictSnapshot: "pass_with_warnings", scoreSnapshot: 65 }),
      ],
      anchoredRunFindings: majors,
    });
    fireEvent.click(screen.getByRole("button", { name: /^aprobar$/i }));
  }

  it("deshabilitado hasta cubrir todos los majors con rationale", async () => {
    renderPendingApprove();
    const dialogApprove = screen.getByRole("button", { name: /confirmar aprobación/i });
    expect(dialogApprove).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/razón global/i), {
      target: { value: "Se acepta el riesgo global" },
    });
    expect(dialogApprove).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /qa-vi-001/i }));
    fireEvent.change(screen.getByLabelText(/justificación qa-vi-001/i), {
      target: { value: "Riesgo menor, se acepta" },
    });
    expect(dialogApprove).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /qa-vi-002/i }));
    fireEvent.change(screen.getByLabelText(/justificación qa-vi-002/i), {
      target: { value: "Se corrige en el siguiente sprint" },
    });
    expect(dialogApprove).not.toBeDisabled();
  });

  it("postea el body exacto de approve con risks", async () => {
    renderPendingApprove();
    fireEvent.change(screen.getByLabelText(/razón global/i), {
      target: { value: "Se acepta el riesgo global" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /qa-vi-001/i }));
    fireEvent.change(screen.getByLabelText(/justificación qa-vi-001/i), {
      target: { value: "Riesgo menor, se acepta" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /qa-vi-002/i }));
    fireEvent.change(screen.getByLabelText(/justificación qa-vi-002/i), {
      target: { value: "Se corrige en el siguiente sprint" },
    });

    fireEvent.click(screen.getByRole("button", { name: /confirmar aprobación/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pixelforge/reviews/rev-1/decision",
        expect.objectContaining({ method: "POST" })
      )
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      action: "approve",
      reason: "Se acepta el riesgo global",
      risks: [
        { findingId: "f-major-1", rationale: "Riesgo menor, se acepta" },
        { findingId: "f-major-2", rationale: "Se corrige en el siguiente sprint" },
      ],
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });
});

describe("ReviewStationPanel — solicitar cambios", () => {
  function renderPendingRequest() {
    renderPanel({
      runs: [runFixture({ verdict: "pass" })],
      reviews: [reviewFixture({ status: "in_review", verdictSnapshot: "pass" })],
    });
    fireEvent.click(screen.getByRole("button", { name: /solicitar cambios/i }));
  }

  it("impacto muestra cascada para contenido/contexto", async () => {
    renderPendingRequest();
    fireEvent.click(screen.getByRole("combobox", { name: /tipo de cambio/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^contenido$/i }));

    fireEvent.click(screen.getByRole("combobox", { name: /destino de contenido/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^contexto$/i }));

    expect(screen.getByText(/invalidará/i)).toBeInTheDocument();
  });

  it("NO muestra cascada para composicion (retrocede a Producción)", async () => {
    renderPendingRequest();
    fireEvent.click(screen.getByRole("combobox", { name: /tipo de cambio/i }));
    fireEvent.click(await screen.findByRole("option", { name: /composición/i }));

    expect(screen.queryByText(/invalidará/i)).not.toBeInTheDocument();
    expect(screen.getByText(/producción/i)).toBeInTheDocument();
  });

  it("postea el body exacto", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    renderPendingRequest();

    fireEvent.click(screen.getByRole("combobox", { name: /tipo de cambio/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^contenido$/i }));
    fireEvent.click(screen.getByRole("combobox", { name: /destino de contenido/i }));
    fireEvent.click(await screen.findByRole("option", { name: /^contexto$/i }));

    fireEvent.change(screen.getByLabelText(/razón del cambio/i), {
      target: { value: "Falta el contexto del cliente" },
    });

    fireEvent.click(screen.getByRole("button", { name: /confirmar solicitud/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/pixelforge/reviews/rev-1/decision",
        expect.objectContaining({ method: "POST" })
      )
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      action: "request_changes",
      changeKind: "contenido",
      contentTarget: "contexto",
      reason: "Falta el contexto del cliente",
    });
  });
});

describe("ReviewStationPanel — timeline", () => {
  it("renderiza los tipos de evento", () => {
    renderPanel({
      events: [
        eventFixture({ id: "e1", type: "review_opened", actorName: "Ana" }),
        eventFixture({ id: "e2", type: "comment_added", actorName: "Miguel" }),
        eventFixture({ id: "e3", type: "approval_granted", actorName: "Ana", reason: "OK" }),
      ],
    });
    expect(screen.getByText(/revisión abierta/i)).toBeInTheDocument();
    expect(screen.getByText(/comentario agregado/i)).toBeInTheDocument();
    expect(screen.getByText(/aprobación otorgada/i)).toBeInTheDocument();
  });
});

describe("ReviewStationPanel — errores de POST", () => {
  it("muestra el error 409 en la zona de decisión", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ ok: false, error: "La revisión ya no está abierta" }),
    });
    renderPanel({
      runs: [runFixture({ verdict: "pass" })],
      reviews: [reviewFixture({ status: "in_review", verdictSnapshot: "pass" })],
    });

    fireEvent.click(screen.getByRole("button", { name: /solicitar cambios/i }));
    fireEvent.click(screen.getByRole("combobox", { name: /tipo de cambio/i }));
    fireEvent.click(await screen.findByRole("option", { name: /composición/i }));
    fireEvent.change(screen.getByLabelText(/razón del cambio/i), {
      target: { value: "Cambiar la composición" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar solicitud/i }));

    expect((await screen.findAllByText(/la revisión ya no está abierta/i)).length).toBeGreaterThan(0);
  });
});
