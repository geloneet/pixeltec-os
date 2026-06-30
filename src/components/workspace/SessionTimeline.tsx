"use client";

import { useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { WorkSession } from "@/types/session";

interface Props {
  session: WorkSession;
}

function formatTime(iso: string): string {
  try { return format(new Date(iso), "HH:mm", { locale: es }); } catch { return "—"; }
}

interface TimelineNode {
  id: string;
  label: string;
  time: string;
  isActive: boolean;
  isStart?: boolean;
}

export function SessionTimeline({ session }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build ordered nodes: session start + each activity (completed or in-progress)
  const nodes: TimelineNode[] = [];

  nodes.push({
    id: "start",
    label: "Inicio",
    time: formatTime(session.startedAt),
    isActive: false,
    isStart: true,
  });

  const sortedActivities = [...session.activities].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  for (const act of sortedActivities) {
    const isActive = !act.completedAt;
    // Truncate long descriptions to keep it compact
    const label = act.description.length > 18
      ? act.description.slice(0, 16).trimEnd() + "…"
      : act.description;
    nodes.push({
      id: act.id,
      label,
      time: formatTime(act.startedAt),
      isActive,
    });
  }

  if (nodes.length <= 1) return null; // Only show once there's at least one activity

  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/20 px-4 py-3">
      <p className="text-[0.6rem] font-medium uppercase tracking-wider text-zinc-700 mb-2">Sesión del día</p>
      {/* Horizontal scroll strip */}
      <div
        ref={scrollRef}
        className="flex items-start gap-0 overflow-x-auto pb-0.5 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {nodes.map((node, i) => (
          <div key={node.id} className="flex items-center flex-shrink-0">
            {/* Node */}
            <div className="flex flex-col items-center">
              <div
                className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  node.isStart
                    ? "border border-zinc-600 bg-transparent"
                    : node.isActive
                      ? "bg-cyan-400"
                      : "bg-zinc-500"
                }`}
              />
              <div className="mt-1 text-center" style={{ minWidth: "48px", maxWidth: "64px" }}>
                <p className={`text-[0.6rem] leading-tight truncate ${
                  node.isActive ? "text-cyan-400" : "text-zinc-500"
                }`}>
                  {node.label}
                </p>
                <p className="text-[0.55rem] text-zinc-700 tabular-nums">{node.time}</p>
              </div>
            </div>

            {/* Connector to next node */}
            {i < nodes.length - 1 && (
              <div className="h-px w-6 bg-white/[0.06] flex-shrink-0 mb-5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
