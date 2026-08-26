"use client";

/**
 * Interruptor del sitemap (WO-2026-00095) — paridad con `/seo/sitemap` de
 * Muebles Encino: activo = todas las páginas publicadas; inactivo = solo la
 * portada.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeoCard, StatusDot } from "./seo-ui";
import { setSitemapEnabled } from "@/lib/seo/actions";

export function SitemapToggle({ initialEnabled, sitemapUrl }: { initialEnabled: boolean; sitemapUrl: string }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const toggle = () =>
    start(async () => {
      const next = !enabled;
      const res = await setSitemapEnabled(next);
      if (res.ok) {
        setEnabled(next);
        toast.success(next ? "Sitemap completo activado." : "Sitemap reducido a la portada.");
      } else {
        toast.error(res.error ?? "No se pudo cambiar.");
      }
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sitemapUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  return (
    <SeoCard>
      <div className="flex items-center gap-2">
        <StatusDot status={enabled ? "ok" : "warn"} />
        <p className="text-sm font-medium text-foreground">{enabled ? "Activo" : "Inactivo"}</p>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {enabled
          ? "El sitemap incluye todas tus páginas publicadas y las entradas del blog."
          : "El sitemap solo incluye la página de inicio."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant={enabled ? "outline" : "default"} size="sm" onClick={toggle} disabled={pending}>
          {pending ? "Cambiando…" : enabled ? "Desactivar" : "Activar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {copied ? "Copiada" : "Copiar la URL del sitemap"}
        </Button>
        <a
          href="/sitemap.xml"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Ver /sitemap.xml
        </a>
      </div>
    </SeoCard>
  );
}
