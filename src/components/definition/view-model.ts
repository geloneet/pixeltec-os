/**
 * View-model serializable (fechas como ISO string) que el server component
 * pasa a los componentes cliente del workspace de definición.
 */
import type { DefinitionStation } from "@/lib/definition/types";
import type { StationStatus } from "@/components/definition/DefinitionStepper";
import type { ThreadMessage } from "@/components/definition/StationThread";

export interface WsStation {
  station: DefinitionStation;
  status: StationStatus;
  currentDraft: string | null;
  sealedContent: string | null;
  sealedAt: string | null;
  sealedByName: string | null;
  reopenCount: number;
}

export interface WsEvent {
  id: string;
  type: "created" | "sealed" | "reopened" | "invalidated" | "converted";
  station: DefinitionStation | null;
  actorName: string;
  reason: string | null;
  createdAt: string;
}

export interface DefinitionViewModel {
  id: string;
  title: string;
  brainDump: string;
  clientName: string;
  clientCrmId: string;
  currentStation: DefinitionStation;
  status: "in_progress" | "completed";
  convertedProjectCrmId: string | null;
  stations: WsStation[];
  messagesByStation: Record<DefinitionStation, ThreadMessage[]>;
  events: WsEvent[];
}
