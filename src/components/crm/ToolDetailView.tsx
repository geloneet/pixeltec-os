"use client";

import { useState } from "react";
import { Lightbulb, Star, Tag } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Tool, KnowledgeTip } from "@/types/crm";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toolLastModified, toolTopTags } from "@/lib/crm/knowledge-stats";
import { useFavorites } from "@/lib/crm/use-favorites";
import { KnowledgeMarkdown } from "@/components/crm/KnowledgeMarkdown";

interface ToolDetailViewProps {
  tool: Tool;
  onBack: () => void;
  onEditTool: () => void;
  onDeleteTool: () => void;
  onAddTip: () => void;
  onEditTip: (tip: KnowledgeTip) => void;
  onDeleteTip: (tipId: string) => void;
}

export function ToolDetailView({
  tool,
  onBack,
  onEditTool,
  onDeleteTool,
  onAddTip,
  onEditTip,
  onDeleteTip,
}: ToolDetailViewProps) {
  const [search, setSearch] = useState("");
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const { isFavorite, toggle } = useFavorites();

  // ── Filtrado de tips ──
  const q = search.toLowerCase().trim();
  const filtered = q
    ? tool.tips.filter(
        (tip) =>
          tip.title.toLowerCase().includes(q) ||
          tip.summary.toLowerCase().includes(q) ||
          tip.content.toLowerCase().includes(q) ||
          tip.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    : tool.tips;

  // ── Derivaciones del recurso ──
  const lastMod = toolLastModified(tool);
  const lastModRel = formatDistanceToNow(new Date(lastMod), {
    locale: es,
    addSuffix: true,
  });
  const lastModExact = format(new Date(lastMod), "d MMM yyyy, HH:mm", {
    locale: es,
  });
  const uniqueTags = new Set(tool.tips.flatMap((t) => t.tags)).size;
  const topTags = toolTopTags(tool, 2);

  const isFav = isFavorite(tool.id);

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* ── Back ── */}
        <button
          onClick={onBack}
          className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Knowledge Hub
        </button>

        {/* ── Header ── */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: tool.color }}
            >
              {tool.icon}
            </span>

            {/* Nombre + acciones */}
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold text-zinc-100 leading-snug">
                {tool.name}
              </h2>
              {topTags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {topTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="flex flex-shrink-0 items-center gap-1">
              {/* Favorito */}
              <button
                onClick={() => toggle(tool.id)}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  isFav
                    ? "text-yellow-400"
                    : "text-zinc-700 hover:text-zinc-400"
                )}
                aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                <Star
                  className={cn("h-4 w-4", isFav && "fill-yellow-400")}
                />
              </button>
              <button
                onClick={onEditTool}
                className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Editar
              </button>
              <button
                onClick={onDeleteTool}
                className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-[12px] text-zinc-400 transition-colors hover:text-red-400"
              >
                Eliminar
              </button>
            </div>
          </div>

          {/* KPIs del recurso */}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.04] pt-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-[15px] font-semibold leading-none text-zinc-100">
                  {tool.tips.length}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {tool.tips.length === 1 ? "tip" : "tips"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
              <div>
                <p className="text-[15px] font-semibold leading-none text-zinc-100">
                  {uniqueTags}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  {uniqueTags === 1 ? "categoría" : "categorías"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="cursor-default text-[12px] font-medium text-zinc-400">
                      editado {lastModRel}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{lastModExact}</p>
                  </TooltipContent>
                </Tooltip>
                <p className="mt-0.5 text-[10px] text-zinc-600">
                  última modificación
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Búsqueda + Añadir tip ── */}
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tips..."
            className="flex-1 rounded-xl border border-white/[0.06] bg-zinc-900/20 px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-cyan-500/30 focus:outline-none focus:bg-zinc-900/40"
          />
          <button
            onClick={onAddTip}
            className="flex-shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[13px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
          >
            + Tip
          </button>
        </div>

        {/* ── Lista de tips ── */}
        {tool.tips.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-500">
              Sin tips aún. Agrega tu primer hack.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-600">
              Sin resultados para &quot;{search}&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((tip) => {
              const isOpen = expandedTip === tip.id;
              const tipRelTime = formatDistanceToNow(
                new Date(tip.updatedAt),
                { locale: es, addSuffix: true }
              );
              const tipExactTime = format(
                new Date(tip.updatedAt),
                "d MMM yyyy, HH:mm",
                { locale: es }
              );

              return (
                <div
                  key={tip.id}
                  className={cn(
                    "rounded-xl border bg-zinc-900/20 transition-colors",
                    isOpen
                      ? "border-white/[0.10]"
                      : "cursor-pointer border-white/[0.06] hover:border-white/[0.10]"
                  )}
                  onClick={() =>
                    !isOpen && setExpandedTip(tip.id)
                  }
                >
                  {/* ── Cabecera del tip ── */}
                  <div
                    className={cn(
                      "flex items-start gap-2 p-3",
                      isOpen && "cursor-pointer"
                    )}
                    onClick={
                      isOpen
                        ? () => setExpandedTip(null)
                        : undefined
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-zinc-100">
                          {tip.title}
                        </p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-shrink-0 cursor-default text-[11px] text-zinc-600">
                              {tipRelTime}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{tipExactTime}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {!isOpen && tip.summary && (
                        <p className="mt-0.5 truncate text-[12px] text-zinc-500">
                          {tip.summary}
                        </p>
                      )}
                      {!isOpen && tip.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {tip.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Indicador de expand/collapse */}
                    <span
                      className={cn(
                        "flex-shrink-0 text-[10px] text-zinc-600 transition-transform mt-0.5",
                        isOpen && "rotate-180"
                      )}
                    >
                      ▾
                    </span>
                  </div>

                  {/* ── Contenido expandido ── */}
                  {isOpen && (
                    <div
                      className="border-t border-white/[0.04] px-3 pb-3 pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Resumen + tags */}
                      {tip.summary && (
                        <p className="mb-2 text-[12px] italic text-zinc-500">
                          {tip.summary}
                        </p>
                      )}
                      {tip.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {tip.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Contenido Markdown */}
                      <KnowledgeMarkdown content={tip.content} />

                      {/* Acciones */}
                      <div
                        className="mt-3 flex items-center justify-end gap-1 border-t border-white/[0.04] pt-3"
                      >
                        <button
                          onClick={() => onEditTip(tip)}
                          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-[12px] text-zinc-500 transition-colors hover:text-zinc-200"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => onDeleteTip(tip.id)}
                          className="rounded-lg border border-white/[0.06] bg-zinc-900/40 px-2.5 py-1 text-[12px] text-zinc-500 transition-colors hover:text-red-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
