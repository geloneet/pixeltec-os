"use client";

import { useState } from "react";
import type { Tool, KnowledgeTip } from "@/types/crm";

interface ToolDetailViewProps {
  tool: Tool;
  onBack: () => void;
  onEditTool: () => void;
  onDeleteTool: () => void;
  onAddTip: () => void;
  onEditTip: (tip: KnowledgeTip) => void;
  onDeleteTip: (tipId: string) => void;
}

export function ToolDetailView({ tool, onBack, onEditTool, onDeleteTool, onAddTip, onEditTip, onDeleteTip }: ToolDetailViewProps) {
  const [search, setSearch] = useState("");
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  const q = search.toLowerCase().trim();
  const filtered = q
    ? tool.tips.filter(tip =>
        tip.title.toLowerCase().includes(q) ||
        tip.summary.toLowerCase().includes(q) ||
        tip.content.toLowerCase().includes(q) ||
        tip.tags.some(tag => tag.toLowerCase().includes(q))
      )
    : tool.tips;

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} className="text-[13px] text-zinc-500 hover:text-zinc-300 mb-4">
        ← Herramientas
      </button>
      <div className="flex items-center gap-3 mb-6">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-base flex-shrink-0"
          style={{ backgroundColor: tool.color }}
        >
          {tool.icon}
        </span>
        <h2 className="text-[20px] font-semibold text-zinc-200 flex-1">{tool.name}</h2>
        <button onClick={onEditTool} className="text-[12px] text-zinc-500 hover:text-zinc-300 px-2 py-1">Editar</button>
        <button onClick={onDeleteTool} className="text-[12px] text-zinc-500 hover:text-red-400 px-2 py-1">Eliminar</button>
      </div>

      {/* Search + Add */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tips..."
          className="flex-1 bg-[#18181B] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0EA5E9] transition-colors duration-150"
        />
        <button
          onClick={onAddTip}
          className="px-3 py-2 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] flex-shrink-0 transition-all duration-150"
        >
          + Tip
        </button>
      </div>

      {/* Tips list */}
      {tool.tips.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-10">Sin tips aún. Agrega tu primer hack.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-10">Sin resultados para &quot;{search}&quot;</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(tip => {
            const isOpen = expandedTip === tip.id;
            return (
              <div
                key={tip.id}
                className="bg-[#18181B] border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-700 transition-all duration-200"
                onClick={() => setExpandedTip(isOpen ? null : tip.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200">{tip.title}</p>
                    {!isOpen && tip.summary && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{tip.summary}</p>
                    )}
                    {!isOpen && tip.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tip.tags.map(tag => (
                          <span key={tag} className="bg-[#0EA5E9]/10 text-[#0EA5E9] text-[10px] px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onEditTip(tip)} className="text-zinc-600 hover:text-zinc-300 p-1 transition-colors duration-150" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => onDeleteTip(tip.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors duration-150" title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-3">
                    {tip.summary && <p className="text-xs text-zinc-500 mb-2">{tip.summary}</p>}
                    {tip.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {tip.tags.map(tag => (
                          <span key={tag} className="bg-[#0EA5E9]/10 text-[#0EA5E9] text-[10px] px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{tip.content}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
