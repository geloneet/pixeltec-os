"use client";

/**
 * Emisión real del «Schema por página» (`/seo/schema`).
 *
 * Hasta WO-2026-00220 el mapa `ruta → tipos` se guardaba en `app_settings` y
 * `/seo/salud` lo reportaba en verde, pero `schemaNodesForPath()` no tenía
 * ningún consumidor: el JSON-LD NUNCA salía en el HTML. Este componente cierra
 * ese hueco.
 *
 * Por qué es cliente y no servidor: el layout raíz no conoce la ruta actual
 * (`usePathname` es la única vía en el App Router sin volver dinámico todo el
 * árbol). No hay penalización de SSR — Next resuelve `usePathname()` también
 * en el render del servidor, así que el `<script>` sale en el HTML inicial,
 * no después de hidratar. El mapa llega ya leído desde el servidor.
 */
import { usePathname } from "next/navigation";
import { absoluteUrl } from "@/lib/site-config";
import {
  getSitePage,
  normalizeSchemaPath,
  schemaNodesForPath,
  type PageSchemaMap,
} from "@/lib/seo/page-schema";

export function PageSchemaJsonLd({ map }: { map: PageSchemaMap }) {
  const pathname = usePathname();
  const path = normalizeSchemaPath(pathname ?? "/");
  const page = getSitePage(path);
  // Rutas fuera del catálogo (admin, blog por slug, 404…) no llevan schema de
  // página: el blog ya emite el suyo por entrada.
  if (!page) return null;

  const nodes = schemaNodesForPath(map, path, {
    title: page.label,
    url: absoluteUrl(page.path),
  });
  if (nodes.length === 0) return null;

  return (
    <>
      {nodes.map((node) => (
        <script
          key={node["@type"]}
          type="application/ld+json"
          // Construido aquí a partir de tipos ya saneados por
          // `sanitizeBlogSchemaTypes`; `JSON.stringify` neutraliza cualquier
          // `</script>` que pudiera venir del título.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
    </>
  );
}
