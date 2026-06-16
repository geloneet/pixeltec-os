import { ListTodo } from "lucide-react";
import { STATUSES, CATEGORIES } from "@/lib/assistant/constants";
import { formatTimeMX } from "@/lib/assistant/week-helpers";
import type { TodayTask } from "@/lib/hoy/types";

function statusMeta(value: string) {
  return STATUSES.find((s) => s.value === value);
}
function categoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value);
}

export function TodayTasksPanel({ tasks }: { tasks: TodayTask[] }) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-5">
      <header className="mb-4 flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-cyan-300" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
          Tareas de hoy
        </h2>
        <span className="ml-auto text-xs text-zinc-500">{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          No tienes tareas programadas para hoy.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => {
            const status = statusMeta(task.status);
            const category = categoryMeta(task.category);
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: category?.color ?? "#71717a" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {task.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatTimeMX(new Date(task.startsAt))} · {task.durationMin} min
                    {task.isOverdue && (
                      <span className="ml-2 text-red-400">vencida</span>
                    )}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: status?.color ?? "#71717a",
                    backgroundColor: `${status?.color ?? "#71717a"}1f`,
                  }}
                >
                  {status?.label ?? task.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
