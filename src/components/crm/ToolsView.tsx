"use client";

import type { Tool } from "@/types/crm";

interface ToolsViewProps {
  tools: Tool[];
  onSelectTool: (id: string) => void;
  onAddTool: () => void;
}

export function ToolsView({ tools, onSelectTool, onAddTool }: ToolsViewProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[20px] font-semibold text-zinc-200">Herramientas</h2>
        <button
          onClick={onAddTool}
          className="px-3 py-1.5 text-sm bg-[#6d5acd] text-white rounded-lg hover:bg-[#5a48b0]"
        >
          + Herramienta
        </button>
      </div>

      {tools.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-16">
          Registra tu primera herramienta y empieza a guardar conocimiento.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="flex items-center gap-3 bg-[#151518] border border-[#2a2a2f] rounded-[10px] px-4 py-4 text-left hover:border-[#3a3a3f] transition-colors"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-base flex-shrink-0"
                style={{ backgroundColor: tool.color }}
              >
                {tool.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-zinc-200 truncate">{tool.name}</p>
                <p className="text-[11px] text-zinc-500">{tool.tips.length} tips</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
