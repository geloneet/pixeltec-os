"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Filtros categoría / mes / búsqueda (paridad Encino `blog-filter-bar.tsx`):
 *  debounce 350 ms, conserva `?estado=` y reinicia la página. */
export function BlogCmsFilterBar({ categories, months }: { categories: string[]; months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => push({ q: q.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectCls = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Categoría" className={selectCls} value={params.get("categoria") ?? ""} onChange={(e) => push({ categoria: e.target.value || null })}>
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <select aria-label="Mes" className={selectCls} value={params.get("fecha") ?? ""} onChange={(e) => push({ fecha: e.target.value || null })}>
        <option value="">Todas las fechas</option>
        {months.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <div className="relative min-w-48 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value.slice(0, 100))} placeholder="Buscar por título…" className="h-9 pl-9" aria-label="Buscar entradas" />
      </div>
    </div>
  );
}
