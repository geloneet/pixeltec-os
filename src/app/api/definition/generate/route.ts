/**
 * POST /api/definition/generate — generación/iteración de UNA estación del
 * pipeline de Definición de Proyecto (las 4 estaciones usan esta misma ruta).
 *
 * Sin `userMessage` => primera generación (auto-kickoff). Con `userMessage` =>
 * iteración ("responder con modificaciones"). Convención de la app: la IA vive
 * en route handlers (Node, single-shot, sin streaming); el CRUD en actions.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { getClientById } from "@/lib/db/repos/crm";
import {
  getDefinitionFull,
  appendMessage,
  updateStationDraft,
} from "@/lib/db/repos/definitions";
import { getStationConfig } from "@/lib/definition/stations";
import {
  getDefinitionClient,
  getDefinitionModel,
  DEFINITION_MAX_TOKENS,
} from "@/lib/definition/model";
import { generateRequestSchema } from "@/lib/definition/schemas";
import type { DefinitionStation } from "@/lib/definition/types";

const MAX_HISTORY = 40;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const ownerId = session?.user?.id;
    if (!ownerId) return fail("No autenticado", 401);

    const parsed = generateRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(parsed.error.errors[0]?.message ?? "Petición inválida", 400);
    }
    const { definitionId, station, userMessage } = parsed.data;

    const full = await getDefinitionFull(definitionId, ownerId);
    if (!full) return fail("Definición no encontrada", 404);

    // ── Compuerta ──────────────────────────────────────────────────────────
    if (full.definition.status === "completed") {
      return fail("El proceso ya está completo", 409);
    }
    if (full.definition.currentStation !== station) {
      return fail("Esta no es la estación activa", 409);
    }
    const stationRow = full.stations.find((s) => s.station === station);
    if (!stationRow) return fail("Estación no encontrada", 404);
    if (stationRow.status === "sealed") {
      return fail("Esta estación ya está sellada", 409);
    }

    // ── Contexto upstream vía sellos ────────────────────────────────────────
    const client = await getClientById(full.definition.clientId, ownerId);
    const sealed: Partial<Record<DefinitionStation, string>> = {};
    for (const s of full.stations) {
      if (s.status === "sealed" && s.sealedContent) sealed[s.station] = s.sealedContent;
    }
    const cfg = getStationConfig(station);
    const kickoff = cfg.buildKickoffMessage({
      clientName: client?.name ?? "Cliente",
      brainDump: full.definition.brainDump,
      sealed,
    });

    // ── Persistir la iteración del usuario (si vino) ────────────────────────
    if (userMessage) {
      await appendMessage(definitionId, station, "user", userMessage);
    }

    // ── Historial de la estación + guarda de alternancia ────────────────────
    // messages ya vienen ordenados asc por createdAt; el userMessage recién
    // insertado quedó al final si aún no estaba en `full`.
    const stationHistory = full.messages
      .filter((m) => m.station === station)
      .map((m) => ({ role: m.role, content: m.content }));
    if (userMessage) stationHistory.push({ role: "user", content: userMessage });

    let history = stationHistory.slice(-MAX_HISTORY);
    // El kickoff es un mensaje `user`: el historial debe empezar con `assistant`
    // para no romper la alternancia de la API.
    if (history[0]?.role === "user") history = history.slice(1);

    const messages = [
      { role: "user" as const, content: kickoff },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    // ── Llamada al modelo (single-shot) ─────────────────────────────────────
    const anthropic = getDefinitionClient();
    const response = await anthropic.messages.create({
      model: getDefinitionModel(),
      max_tokens: DEFINITION_MAX_TOKENS,
      system: cfg.systemPrompt,
      messages,
    });

    const draft = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    if (!draft) return fail("La IA no devolvió contenido", 502);

    await appendMessage(definitionId, station, "assistant", draft);
    await updateStationDraft(definitionId, station, draft);

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    console.error("[definition/generate]", err);
    return fail("Error generando la respuesta", 500);
  }
}
