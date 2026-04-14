"use client";

import { useState, useRef, useEffect } from "react";
import type { CRMClient, Tool } from "@/types/crm";

interface SearchResult {
  type: "client" | "project" | "task" | "key" | "tip";
  label: string;
  sub: string;
  cid: string;
  pid?: string;
  toolId?: string;
}

interface SearchViewProps {
  clients: CRMClient[];
  tools: Tool[];
  navigateToClient: (id: string) => void;
  navigateToProject: (cid: string, pid: string) => void;
  navigateToTool: (toolId: string) => void;
}

export function SearchView({ clients, tools, navigateToClient, navigateToProject, navigateToTool }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  if (q) {
    clients.forEach(c => {
      if (c.name.toLowerCase().includes(q)) {
        results.push({ type: "client", label: c.name, sub: "Cliente", cid: c.id });
      }
      c.projects.forEach(p => {
        if (p.name.toLowerCase().includes(q) || p.domain.toLowerCase().includes(q) || p.tech.toLowerCase().includes(q)) {
          results.push({ type: "project", label: p.name, sub: `Proyecto · ${c.name}`, cid: c.id, pid: p.id });
        }
        p.tasks.forEach(t => {
          if (t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)) {
            results.push({ type: "task", label: t.name, sub: `Tarea · ${p.name} · ${c.name}`, cid: c.id, pid: p.id });
          }
        });
        p.keys.forEach(k => {
          if (k.label.toLowerCase().includes(q)) {
            results.push({ type: "key", label: k.label, sub: `Llave · ${p.name} · ${c.name}`, cid: c.id, pid: p.id });
          }
        });
      });
    });
    tools.forEach(tool => {
      if (tool.name.toLowerCase().includes(q)) {
        results.push({ type: "tip", label: tool.name, sub: "Herramienta", cid: "", toolId: tool.id });
      }
      tool.tips.forEach(tip => {
        if (tip.title.toLowerCase().includes(q) || tip.summary.toLowerCase().includes(q) || tip.content.toLowerCase().includes(q) || tip.tags.some(tag => tag.toLowerCase().includes(q))) {
          results.push({ type: "tip", label: tip.title, sub: `${tool.name} · tip`, cid: "", toolId: tool.id });
        }
      });
    });
  }

  const handleClick = (r: SearchResult) => {
    if (r.toolId) {
      navigateToTool(r.toolId);
    } else if (r.type === "client") {
      navigateToClient(r.cid);
    } else if (r.pid) {
      navigateToProject(r.cid, r.pid);
    }
  };

  return (
    <div>
      <h2 className="text-[20px] font-semibold text-zinc-200 mb-4">Buscar</h2>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar clientes, proyectos, tareas, llaves..."
        className="w-full bg-[#1c1c20] border border-[#2a2a2f] rounded-lg px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-[#6d5acd] mb-4"
      />

      {q && results.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-10">Sin resultados para &quot;{query}&quot;</p>
      )}

      <div className="space-y-2">
        {results.map((r, i) => (
          <button
            key={`${r.type}-${r.cid}-${r.pid || ""}-${i}`}
            onClick={() => handleClick(r)}
            className="flex w-full items-center gap-3 bg-[#151518] border border-[#2a2a2f] rounded-[10px] px-4 py-3 text-left hover:border-[#3a3a3f] transition-colors"
          >
            <span className="text-[11px] text-zinc-600 uppercase w-16 flex-shrink-0">{r.type}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-zinc-200 truncate">{r.label}</p>
              <p className="text-[11px] text-zinc-500 truncate">{r.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
