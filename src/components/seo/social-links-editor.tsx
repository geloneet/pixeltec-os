"use client";

/**
 * Redes sociales (WO-2026-00095) — paridad con `social-links-editor.tsx` de
 * Muebles Encino. Los enlaces activos alimentan `sameAs` en los datos
 * estructurados del negocio.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SeoCard } from "./seo-ui";
import { saveSocialLinks } from "@/lib/seo/actions";
import { isValidSocialHref, type SocialLink } from "@/lib/seo/social";

export function SocialLinksEditor({ initial }: { initial: SocialLink[] }) {
  const [links, setLinks] = useState<SocialLink[]>(initial);
  const [saving, startSave] = useTransition();

  const patch = (label: string, next: Partial<SocialLink>) =>
    setLinks((ls) => ls.map((l) => (l.label === label ? { ...l, ...next } : l)));

  const save = () =>
    startSave(async () => {
      const res = await saveSocialLinks(links);
      if (res.ok) toast.success("Guardado.");
      else toast.error(res.error ?? "No se pudo guardar.");
    });

  return (
    <div className="space-y-3">
      {links.map((link) => {
        const bad = link.href.trim().length > 0 && !isValidSocialHref(link.href);
        return (
          <SeoCard key={link.label}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex w-32 items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={link.enabled}
                  onChange={(e) => patch(link.label, { enabled: e.target.checked })}
                  className="h-4 w-4"
                  aria-label={`Publicar ${link.label}`}
                />
                {link.label}
              </label>
              <Input
                value={link.href}
                onChange={(e) => patch(link.label, { href: e.target.value })}
                placeholder={`https://…`}
                aria-label={`Enlace de ${link.label}`}
                className="min-w-0 flex-1"
              />
            </div>
            {bad ? (
              <p className="mt-1.5 text-xs text-destructive">
                Ese enlace no es una URL válida — debe empezar por https://
              </p>
            ) : null}
          </SeoCard>
        );
      })}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Solo se publican las redes marcadas y con una URL válida.
        </p>
      </div>
    </div>
  );
}
