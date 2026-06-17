import type { Tool } from "@/types/crm";

export interface HubStats {
  resources: number;
  tips: number;
  categories: number;
}

export function deriveHubStats(tools: Tool[]): HubStats {
  const tags = new Set<string>();
  let tips = 0;
  for (const t of tools) {
    tips += t.tips.length;
    for (const tip of t.tips) {
      for (const tag of tip.tags) tags.add(tag.toLowerCase());
    }
  }
  return { resources: tools.length, tips, categories: tags.size };
}

/** max(tip.updatedAt) para un recurso; fallback al createdAt del recurso. */
export function toolLastModified(tool: Tool): string {
  let last = tool.createdAt;
  for (const tip of tool.tips) {
    if (tip.updatedAt > last) last = tip.updatedAt;
  }
  return last;
}

/** Tags más frecuentes del recurso (derivados de sus tips), top N. */
export function toolTopTags(tool: Tool, limit = 2): string[] {
  const freq = new Map<string, number>();
  for (const tip of tool.tips) {
    for (const tag of tip.tags) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

/** Filtro por substring: nombre del recurso + título/resumen/contenido/tags de sus tips. */
export function filterTools(tools: Tool[], query: string): Tool[] {
  const q = query.toLowerCase().trim();
  if (!q) return tools;
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.tips.some(
        (tip) =>
          tip.title.toLowerCase().includes(q) ||
          tip.summary.toLowerCase().includes(q) ||
          tip.content.toLowerCase().includes(q) ||
          tip.tags.some((tag) => tag.toLowerCase().includes(q))
      )
  );
}

/** Top N recursos ordenados por última modificación descendente. */
export function recentTools(tools: Tool[], limit = 4): Tool[] {
  return [...tools]
    .sort((a, b) => (toolLastModified(a) > toolLastModified(b) ? -1 : 1))
    .slice(0, limit);
}
