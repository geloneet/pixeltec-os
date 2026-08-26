"use client";

/**
 * Schema por página (WO-2026-00095) — paridad con `schema-editor.tsx` de
 * Muebles Encino: a cada página pública del sitio se le asignan tipos
 * schema.org que se publican como JSON-LD.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeoCard } from "./seo-ui";
import { savePageSchema } from "@/lib/seo/actions";
import { selectableBlogSchemaTypes } from "@/lib/blog-cms/schema-types";
import type { PageSchemaMap, SitePage } from "@/lib/seo/page-schema";

export function PageSchemaEditor({ pages, initial }: { pages: SitePage[]; initial: PageSchemaMap }) {
  const [map, setMap] = useState<PageSchemaMap>(initial);
  const [pending, startTransition] = useTransition();
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const options = selectableBlogSchemaTypes();

  const update = (path: string, types: string[]) => setMap((m) => ({ ...m, [path]: types }));

  const save = (path: string) => {
    setSavingPath(path);
    startTransition(async () => {
      const res = await savePageSchema(path, map[path] ?? []);
      if (res.ok) toast.success("Guardado.");
      else toast.error(res.error ?? "No se pudo guardar.");
      setSavingPath(null);
    });
  };

  return (
    <div className="space-y-3">
      {pages.map((page) => {
        const types = map[page.path] ?? [];
        return (
          <SeoCard key={page.path}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{page.label}</p>
              <code className="text-xs text-muted-foreground">{page.path}</code>
            </div>

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
                variant="outline"
                onClick={() => save(page.path)}
                disabled={pending && savingPath === page.path}
              >
                {pending && savingPath === page.path ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </SeoCard>
        );
      })}
    </div>
  );
}
