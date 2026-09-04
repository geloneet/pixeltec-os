"use client";

/**
 * Schema por página (WO-2026-00095) — paridad con `schema-editor.tsx` de
 * Muebles Encino: a cada página pública del sitio se le asignan tipos
 * schema.org que se publican como JSON-LD.
 *
 * WO-2026-00220 añade «Sugerir con IA» (global y por página). La IA propone;
 * los tipos no se asignan hasta que Miguel acepta el chip, y no se publican
 * hasta que pulsa Guardar en esa tarjeta.
 */
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeoCard } from "./seo-ui";
import { savePageSchema, suggestPageSchema } from "@/lib/seo/actions";
import { selectableBlogSchemaTypes } from "@/lib/blog-cms/schema-types";
import type { PageSchemaMap, SitePage } from "@/lib/seo/page-schema";
import type { SuggestedType } from "@/lib/seo/page-schema-suggest";

type SuggestionsByPath = Record<string, SuggestedType[]>;

const sameTypes = (a: string[], b: string[]) =>
  a.length === b.length && a.every((t, i) => t === b[i]);

export function PageSchemaEditor({ pages, initial }: { pages: SitePage[]; initial: PageSchemaMap }) {
  const [map, setMap] = useState<PageSchemaMap>(initial);
  const [saved, setSaved] = useState<PageSchemaMap>(initial);
  const [suggestions, setSuggestions] = useState<SuggestionsByPath>({});
  const [pending, startTransition] = useTransition();
  const [savingPath, setSavingPath] = useState<string | null>(null);
  /** `"*"` mientras corre la sugerencia global; la ruta si es de una página. */
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const options = useMemo(() => selectableBlogSchemaTypes(), []);

  const update = (path: string, types: string[]) => setMap((m) => ({ ...m, [path]: types }));

  const dirty = (path: string) => !sameTypes(map[path] ?? [], saved[path] ?? []);

  const save = (path: string) => {
    setSavingPath(path);
    startTransition(async () => {
      const types = map[path] ?? [];
      const res = await savePageSchema(path, types);
      if (res.ok) {
        setSaved((s) => ({ ...s, [path]: types }));
        toast.success("Guardado.");
      } else {
        toast.error(res.error ?? "No se pudo guardar.");
      }
      setSavingPath(null);
    });
  };

  const suggest = async (paths: string[], scope: string) => {
    setSuggesting(scope);
    try {
      const res = await suggestPageSchema(paths);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "No se pudo sugerir con IA.");
        return;
      }
      const next: SuggestionsByPath = {};
      let total = 0;
      for (const s of res.data.suggestions) {
        next[s.path] = s.types;
        total += s.types.length;
      }
      setSuggestions((prev) => ({ ...prev, ...next }));
      if (total > 0) {
        toast.success(`${total} sugerencia${total === 1 ? "" : "s"}. Acepta las que te sirvan y guarda.`);
      } else {
        toast.info("La IA no vio nada que agregar aquí.");
      }
    } finally {
      setSuggesting(null);
    }
  };

  const accept = (path: string, type: string) => {
    const types = map[path] ?? [];
    if (!types.includes(type)) update(path, [...types, type]);
    setSuggestions((prev) => ({ ...prev, [path]: (prev[path] ?? []).filter((s) => s.type !== type) }));
  };

  const acceptAll = (path: string) => {
    const list = suggestions[path] ?? [];
    const types = map[path] ?? [];
    const merged = [...types];
    for (const s of list) if (!merged.includes(s.type)) merged.push(s.type);
    update(path, merged);
    setSuggestions((prev) => ({ ...prev, [path]: [] }));
  };

  const dismiss = (path: string) => setSuggestions((prev) => ({ ...prev, [path]: [] }));

  return (
    <div className="space-y-3">
      <SeoCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            ¿No sabes qué tipo le toca a cada página? Deja que la IA proponga y tú decides.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => suggest(pages.map((p) => p.path), "*")}
            disabled={suggesting !== null}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {suggesting === "*" ? "Analizando…" : "Sugerir con IA para todas las páginas"}
          </Button>
        </div>
      </SeoCard>

      {pages.map((page) => {
        const types = map[page.path] ?? [];
        const pageSuggestions = suggestions[page.path] ?? [];
        const unsaved = dirty(page.path);
        return (
          <SeoCard key={page.path}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{page.label}</p>
              <div className="flex items-center gap-1">
                <code className="text-xs text-muted-foreground">{page.path}</code>
                <button
                  type="button"
                  aria-label={`Sugerir con IA para ${page.label}`}
                  title={`Sugerir con IA para ${page.label}`}
                  onClick={() => suggest([page.path], page.path)}
                  disabled={suggesting !== null}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-40"
                >
                  <Sparkles
                    className={suggesting === page.path ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"}
                  />
                </button>
              </div>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{page.description}</p>

            {types.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground"
                  >
                    {t}
                    <button
                      type="button"
                      aria-label={`Quitar ${t} de ${page.label}`}
                      onClick={() => update(page.path, types.filter((x) => x !== t))}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Sin tipos asignados.</p>
            )}

            {pageSuggestions.length > 0 && (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sugerido por la IA
                </p>
                <ul className="mt-2 space-y-1.5">
                  {pageSuggestions.map((s) => (
                    <li key={s.type} className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => accept(page.path, s.type)}
                        aria-label={`Agregar ${s.type} a ${page.label}`}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-foreground/40 px-2 py-0.5 text-xs text-foreground transition-colors hover:border-solid hover:bg-secondary/60"
                      >
                        + {s.type}
                      </button>
                      <span className="flex-1 text-[11px] leading-snug text-muted-foreground">{s.reason}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-3 text-[11px]">
                  <button
                    type="button"
                    onClick={() => acceptAll(page.path)}
                    className="text-foreground underline underline-offset-4 hover:opacity-80"
                  >
                    Aceptar todas
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(page.path)}
                    className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value=""
                aria-label={`Agregar tipo a ${page.label}`}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && !types.includes(v)) update(page.path, [...types, v]);
                }}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">+ Agregar tipo…</option>
                {options
                  .filter((t) => !types.includes(t.value))
                  .map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant={unsaved ? "default" : "outline"}
                onClick={() => save(page.path)}
                disabled={pending && savingPath === page.path}
              >
                {pending && savingPath === page.path
                  ? "Guardando…"
                  : unsaved
                    ? "Guardar cambios"
                    : "Guardar"}
              </Button>
              {unsaved && (
                <span className="text-[11px] text-amber-500">Cambios sin guardar</span>
              )}
            </div>
          </SeoCard>
        );
      })}
    </div>
  );
}
