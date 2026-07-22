/**
 * Mapa de retorno de un "changes_requested" de revisión: dado el TIPO de
 * cambio que pide el revisor, resuelve a qué estación/artifact hay que
 * mandar el proyecto y por qué MECANISMO (T4/T5 lo ejecutan; este módulo
 * solo resuelve el destino, puro).
 *
 * Mapa CERRADO — verificado contra `KIND_STATION` real de
 * `src/lib/pixelforge/types.ts` (vía `stationForKind`, la única superficie
 * exportada de esa tabla) antes de fijarlo acá:
 *   context_brief       → contexto
 *   landing_dna         → estrategia   (el kind que sella la estación
 *                                        "estrategia" es `landing_dna`, NO
 *                                        un kind llamado "estrategia" —
 *                                        confirmado leyendo `KIND_STATION`,
 *                                        no asumido)
 *   visual_dna          → visual
 *   direction_decision  → direcciones
 *   narrative_blueprint → blueprint
 *
 * `contenido` es el único `ChangeKind` con sub-destino: el revisor debe
 * decir CUÁL de los tres artifacts de contenido tocar (`contentTarget`)
 * porque "contenido" por sí solo es ambiguo entre tres estaciones muy
 * distintas — sin ese dato no hay mapa posible y se lanza.
 */
import { stationForKind, type PixelforgeArtifactKind, type PixelforgeStation } from "@/lib/pixelforge/types";

export type ChangeKind =
  | "contenido"
  | "direccion_visual"
  | "estructura"
  | "composicion"
  | "defecto_tecnico"
  | "defecto_registry";

export interface ChangeTarget {
  station: PixelforgeStation | null;
  mechanism: "reopen_artifact" | "regress_station" | "technical_block";
  artifactKind: PixelforgeArtifactKind | null;
}

function reopen(kind: PixelforgeArtifactKind): ChangeTarget {
  return { station: stationForKind(kind), mechanism: "reopen_artifact", artifactKind: kind };
}

/**
 * Resuelve el destino del cambio pedido en una review. `contentTarget` solo
 * aplica (y es obligatorio) cuando `kind === "contenido"`; se ignora para
 * cualquier otro kind.
 */
export function resolveChangeTarget(
  kind: ChangeKind,
  contentTarget?: "contexto" | "estrategia" | "blueprint"
): ChangeTarget {
  switch (kind) {
    case "contenido": {
      if (contentTarget === "contexto") return reopen("context_brief");
      if (contentTarget === "estrategia") return reopen("landing_dna");
      if (contentTarget === "blueprint") return reopen("narrative_blueprint");
      throw new Error(
        "resolveChangeTarget: el cambio de tipo 'contenido' requiere `contentTarget` ('contexto' | 'estrategia' | 'blueprint') para saber qué artifact reabrir."
      );
    }
    case "direccion_visual":
      return reopen("direction_decision");
    case "estructura":
      return reopen("narrative_blueprint");
    case "composicion":
    case "defecto_tecnico":
      return { station: "produccion", mechanism: "regress_station", artifactKind: null };
    case "defecto_registry":
      return { station: null, mechanism: "technical_block", artifactKind: null };
    default: {
      const exhaustive: never = kind;
      throw new Error(`resolveChangeTarget: ChangeKind no soportado: ${String(exhaustive)}`);
    }
  }
}
