/**
 * Los 3 viewports de la pasada nav (PF-F8 T6, D del plan) — anchos EXACTOS
 * del plan maestro; altos razonables (no especificados por el plan, elegidos
 * para que cada viewport tenga proporción de dispositivo real: ~16:10
 * desktop, ~3:4 tablet retrato, ~9:19.5 móvil moderno).
 */
export interface QaViewport {
  name: "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
}

export const QA_VIEWPORTS: readonly QaViewport[] = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;
