"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Rocket, Server, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCmdK } from "./CmdKProvider";
import { useCRM } from "@/components/crm/CRMContext";
import { useVpsStatus } from "@/lib/vps-swr";
import { normalize, searchAcrossCRM } from "@/lib/cmdk-search";

export function CmdKDialog() {
  const { open, setOpen } = useCmdK();
  const [query, setQuery] = useState("");
  const router = useRouter();
  const crm = useCRM();
  const { data: vpsData } = useVpsStatus();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(
    () =>
      searchAcrossCRM({
        query,
        clients: crm.clients || [],
        vpsProjects: vpsData?.projects || [],
      }),
    [query, crm.clients, vpsData?.projects],
  );

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const hasAny =
    results.clients.length +
      results.projects.length +
      results.tasks.length +
      results.vpsProjects.length >
    0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar clientes, proyectos, tareas, VPS..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          {query ? `Sin resultados para "${query}"` : "Empieza a escribir..."}
        </CommandEmpty>

        {results.clients.length > 0 && (
          <CommandGroup heading="Clientes">
            {results.clients.map((client) => (
              <CommandItem
                key={`client-${client.id}`}
                value={normalize(`cliente ${client.name} ${client.email}`)}
                onSelect={() => handleSelect(`/clientes/${client.id}`)}
              >
                <Users className="mr-3 h-4 w-4 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-100 truncate">
                    {client.name}
                  </div>
                  {client.email && (
                    <div className="text-xs text-zinc-500 truncate">
                      {client.email}
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.projects.length > 0 && (
          <>
            {results.clients.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Proyectos">
              {results.projects.map((p) => (
                <CommandItem
                  key={`project-${p.id}`}
                  value={normalize(`proyecto ${p.name} ${p.clientName}`)}
                  onSelect={() => handleSelect(`/proyectos/${p.id}`)}
                >
                  <Rocket className="mr-3 h-4 w-4 text-indigo-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100 truncate">
                      {p.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      Cliente: {p.clientName}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.tasks.length > 0 && (
          <>
            {(results.clients.length > 0 || results.projects.length > 0) && (
              <CommandSeparator />
            )}
            <CommandGroup heading="Tareas">
              {results.tasks.map((t) => (
                <CommandItem
                  key={`task-${t.id}`}
                  value={normalize(
                    `tarea ${t.name} ${t.projectName} ${t.clientName}`,
                  )}
                  onSelect={() =>
                    handleSelect(`/proyectos/${t.projectId}?tab=tareas`)
                  }
                >
                  <CheckSquare className="mr-3 h-4 w-4 text-emerald-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100 truncate">
                      {t.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {t.projectName} · {t.clientName}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.vpsProjects.length > 0 && (
          <>
            {hasAny && <CommandSeparator />}
            <CommandGroup heading="VPS">
              {results.vpsProjects.map((vp) => (
                <CommandItem
                  key={`vps-${vp.id}`}
                  value={normalize(`vps ${vp.name} ${vp.domain ?? ""} ${vp.type}`)}
                  onSelect={() => handleSelect("/vps")}
                >
                  <Server className="mr-3 h-4 w-4 text-orange-400" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100 truncate">
                      {vp.name}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {vp.domain || "Sin dominio"} · {vp.type}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
      <div className="flex items-center justify-between border-t border-zinc-800/70 px-3 py-2 text-[11px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              ↑↓
            </kbd>{" "}
            Navegar
          </span>
          <span>
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              ↵
            </kbd>{" "}
            Abrir
          </span>
          <span>
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              Esc
            </kbd>{" "}
            Cerrar
          </span>
        </div>
      </div>
    </CommandDialog>
  );
}
