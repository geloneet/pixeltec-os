"use client";

import { useState } from "react";

interface Props {
  tech: string;
}

interface Command {
  cmd: string;
  desc: string;
}

function getCommands(tech: string): Command[] {
  const t = tech.toLowerCase();
  const commands: Command[] = [];

  if (t.includes("next") || t.includes("react")) {
    commands.push(
      { cmd: "npm run dev", desc: "Inicia entorno local" },
      { cmd: "npm run build", desc: "Genera build de producción" },
      { cmd: "npm run lint", desc: "Revisa errores de código" },
    );
  }

  if (t.includes("docker")) {
    commands.push(
      { cmd: "docker compose up", desc: "Levanta servicios" },
      { cmd: "docker compose down", desc: "Detiene servicios" },
      { cmd: "docker compose logs -f", desc: "Ve los logs en vivo" },
    );
  }

  // Always include git
  commands.push(
    { cmd: "git status", desc: "Muestra cambios pendientes" },
    { cmd: "git add . && git commit -m 'msg'", desc: "Registra cambios" },
    { cmd: "git push", desc: "Sube cambios" },
  );

  return commands;
}

const DEPLOY_CHECKLIST = [
  "Build local exitoso",
  "Validación mobile",
  "Consola limpia",
  "Variables de entorno revisadas",
  "Commit realizado",
];

export function SmartSidebar({ tech }: Props) {
  const [deployChecks, setDeployChecks] = useState<Set<number>>(new Set());
  const commands = getCommands(tech);

  const toggleCheck = (i: number) => {
    setDeployChecks(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pb-6">

      {/* Recuerda */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
        <p className="mb-2 text-xs font-semibold text-amber-400">⚠️ Recuerda</p>
        <ul className="space-y-1">
          {[
            "Trabaja en localhost",
            "No modificar producción directamente",
            "Validar mobile antes de deploy",
            "Revisar consola de errores",
            "Revisar logs del servidor",
          ].map(tip => (
            <li key={tip} className="flex items-start gap-1.5 text-xs text-zinc-400">
              <span className="mt-0.5 text-amber-500/70">·</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Buen hábito */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-2 text-xs font-semibold text-zinc-400">💡 Buen hábito</p>
        <p className="mb-2 text-xs text-zinc-500">Haz commit frecuente. Antes de terminar:</p>
        <div className="space-y-1 font-mono text-[11px] text-zinc-400">
          <p>git status</p>
          <p>git commit -m &quot;...&quot;</p>
          <p>git push</p>
        </div>
      </div>

      {/* Deploy seguro */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-3 text-xs font-semibold text-zinc-400">Deploy seguro</p>
        <div className="space-y-2">
          {DEPLOY_CHECKLIST.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleCheck(i)}
              className="flex w-full items-center gap-2 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <span
                className={`h-3.5 w-3.5 flex-shrink-0 rounded border transition-all ${
                  deployChecks.has(i)
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : "border-zinc-700"
                }`}
              >
                {deployChecks.has(i) && (
                  <span className="flex h-full items-center justify-center text-[9px]">✓</span>
                )}
              </span>
              <span className={deployChecks.has(i) ? "line-through text-zinc-600" : ""}>{item}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comandos útiles */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 p-4">
        <p className="mb-3 text-xs font-semibold text-zinc-400">
          Comandos útiles
          {tech && <span className="ml-1.5 text-zinc-600">({tech})</span>}
        </p>
        <div className="space-y-2.5">
          {commands.map((c, i) => (
            <div key={i}>
              <p className="font-mono text-[11px] text-cyan-400">{c.cmd}</p>
              <p className="text-[10px] text-zinc-600">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
