"use client";

import { useMemo, useState } from "react";
import { BookOpen, Lightbulb, Search, Star, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Tool } from "@/types/crm";
import { cn } from "@/lib/utils";
import {
  deriveHubStats,
  filterTools,
  recentTools,
  toolLastModified,
  toolTopTags,
} from "@/lib/crm/knowledge-stats";
import { useFavorites } from "@/lib/crm/use-favorites";
import { getNavLabel } from "@/components/nav/command-palette-items";

interface ToolsViewProps {
  tools: Tool[];
  onSelectTool: (id: string) => void;
  onAddTool: () => void;
}

interface ToolCardProps {
  tool: Tool;
  onSelect: () => void;
  isFav: boolean;
  onToggleFav: (e: React.MouseEvent) => void;
}

function ToolCard({ tool, onSelect, isFav, onToggleFav }: ToolCardProps) {
  const tags = toolTopTags(tool, 2);
  const lastMod = toolLastModified(tool);
  const relTime = formatDistanceToNow(new Date(lastMod), {
    locale: es,
    addSuffix: true,
  });

  return (
    <div
      onClick={onSelect}
      className="group relative flex cursor-pointer flex-col gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4 transition-colors hover:border-white/[0.12] hover:bg-zinc-900/40"
    >
      {/* Estrella favorito */}
      <button
        onClick={onToggleFav}
        className={cn(
          "absolute right-3 top-3 rounded p-0.5 transition-colors",
          isFav
            ? "text-yellow-400"
            : "text-zinc-700 hover:text-zinc-400"
        )}
        aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
      >
        <Star
          className={cn("h-3.5 w-3.5", isFav && "fill-yellow-400")}
        />
      </button>

      {/* Avatar */}
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base"
        style={{ backgroundColor: tool.color }}
      >
        {tool.icon}
      </span>

      {/* Nombre */}
      <p className="pr-6 text-[13px] font-medium leading-snug text-zinc-100">
        {tool.name}
      </p>

      {/* Tags derivados */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
        <span>
          {tool.tips.length} {tool.tips.length === 1 ? "tip" : "tips"}
        </span>
        <span>·</span>
        <span>editado {relTime}</span>
      </div>
    </div>
  );
}

export function ToolsView({ tools, onSelectTool, onAddTool }: ToolsViewProps) {
  const [search, setSearch] = useState("");
  const { isFavorite, toggle } = useFavorites();

  const stats = useMemo(() => deriveHubStats(tools), [tools]);
  const filtered = useMemo(
    () => filterTools(tools, search),
    [tools, search]
  );
  const recent = useMemo(() => recentTools(tools, 4), [tools]);
  const favTools = useMemo(
    () => tools.filter((t) => isFavorite(t.id)),
    [tools, isFavorite]
  );

  const hasQuery = search.trim().length > 0;
  const showFavs = !hasQuery && favTools.length > 0;
  const showRecent = !hasQuery && tools.length > 4;

  const sectionLabel =
    "mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-600";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-zinc-100">
            {getNavLabel("/accesos")}
          </h2>
          <p className="text-[12px] text-zinc-500">
            Base de conocimiento interna y recursos operativos
          </p>
        </div>
        <button
          onClick={onAddTool}
          className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[13px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          + Recurso
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            Icon: BookOpen,
            label: "Recursos",
            value: stats.resources,
            colorClass: "text-cyan-400",
          },
          {
            Icon: Lightbulb,
            label: "Tips",
            value: stats.tips,
            colorClass: "text-amber-400",
          },
          {
            Icon: Tag,
            label: "Categorías",
            value: stats.categories,
            colorClass: "text-violet-400",
          },
        ].map(({ Icon, label, value, colorClass }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-3"
          >
            <Icon className={cn("mb-1.5 h-4 w-4", colorClass)} />
            <p className="text-[18px] font-semibold leading-none text-zinc-100">
              {value}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Búsqueda ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en recursos, tips y contenido..."
          className="w-full rounded-xl border border-white/[0.06] bg-zinc-900/20 py-2.5 pl-9 pr-4 text-[13px] text-zinc-200 placeholder:text-zinc-600 transition-colors focus:border-cyan-500/30 focus:bg-zinc-900/40 focus:outline-none"
        />
      </div>

      {/* ── Sin recursos ── */}
      {tools.length === 0 && (
        <p className="py-16 text-center text-sm text-zinc-500">
          Aún no hay recursos registrados.
        </p>
      )}

      {/* ── Resultados de búsqueda ── */}
      {hasQuery && (
        <section>
          <p className={sectionLabel}>Resultados ({filtered.length})</p>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-600">
              Sin resultados para &quot;{search}&quot;
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((tool) => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  onSelect={() => onSelectTool(tool.id)}
                  isFav={isFavorite(tool.id)}
                  onToggleFav={(e) => {
                    e.stopPropagation();
                    toggle(tool.id);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Favoritos ── */}
      {showFavs && (
        <section>
          <p className={sectionLabel}>★ Favoritos</p>
          <div className="grid grid-cols-2 gap-3">
            {favTools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onSelect={() => onSelectTool(tool.id)}
                isFav={true}
                onToggleFav={(e) => {
                  e.stopPropagation();
                  toggle(tool.id);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Recientes ── */}
      {showRecent && (
        <section>
          <p className={sectionLabel}>Recientes</p>
          <div className="grid grid-cols-2 gap-3">
            {recent.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onSelect={() => onSelectTool(tool.id)}
                isFav={isFavorite(tool.id)}
                onToggleFav={(e) => {
                  e.stopPropagation();
                  toggle(tool.id);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Todos los recursos ── */}
      {!hasQuery && tools.length > 0 && (
        <section>
          <p className={sectionLabel}>Todos los recursos ({tools.length})</p>
          <div className="grid grid-cols-2 gap-3">
            {tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onSelect={() => onSelectTool(tool.id)}
                isFav={isFavorite(tool.id)}
                onToggleFav={(e) => {
                  e.stopPropagation();
                  toggle(tool.id);
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
