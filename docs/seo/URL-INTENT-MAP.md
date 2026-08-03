# Mapa URL × intención — pixeltec.mx

Matriz canónica (G1). Volumen/dificultad: SIN fuente de datos aún — todo lo
marcado `[Hipótesis]` se valida con Search Console cuando haya impresiones.
Estados: existente · optimizar · consolidar · crear · redirigir · archivar.

| URL | Tipo | Intención | Keyword principal [Hipótesis] | Funnel | CTA | Estado | Notas |
|---|---|---|---|---|---|---|---|
| / | home | navegacional + comercial | desarrollo de software a medida méxico | awareness | diagnóstico | optimizar | H1 y primer viewport deben decir qué/para quién/resultado |
| /services | hub servicios | investigación comercial | agencia desarrollo web y automatización | consideration | contacto | optimizar | página de conversión #1; hoy 'use client' completa |
| /services/ecosistemas-web | servicio | investigación comercial | desarrollo web empresarial nextjs | consideration | contacto | optimizar | evidencia real pendiente |
| /services/automatizacion | servicio | investigación comercial | automatización de procesos con ia | consideration | diagnóstico | optimizar | conectar con artículos del pilar |
| /services/consultoria | servicio | investigación comercial | consultoría tecnológica pymes | consideration | contacto | optimizar | |
| /pixelbot | producto | transaccional | chatbot whatsapp para empresas | decision | lead form | existente | mejor plantilla del repo; 5 aliases 301 |
| /blog | listado | informacional | blog tecnología para pymes | awareness | suscripción (futuro) | existente | CollectionPage + breadcrumb añadidos |
| /blog/[slug] | artículo | informacional | por artículo (seo.primaryKeyword) | awareness→consideration | diagnóstico/contacto | optimizar | plantilla renovada en este incremento |
| /industrias | segmentos | investigación comercial | software para [industria] | consideration | contacto | optimizar | no indexar variantes vacías; sin experiencia inventada |
| /diagnostico | herramienta | transaccional | diagnóstico madurez digital | decision | wizard | existente | conversión propia del OS |
| /about · /equipo · /metodologia | confianza | navegacional | pixeltec | consideration | contacto | existente | E-E-A-T: /equipo debe sostener las bios de autor del blog |
| /contact | conversión | transaccional | contacto pixeltec | decision | form | existente | NAP consistente con site-config |
| /guias-transformacion | recursos | informacional | guías transformación digital | awareness | lead magnet | crear contenido | hoy es cascarón: o se llena o se saca del sitemap |
| legales (aviso/términos/data-deletion) | legal | navegacional | — | — | — | existente | prioridad baja del sitemap, correcta |
| /blog/<7 demo> | retirados | — | — | — | — | redirigido | 308 → /blog (2026-08-03) |
| /login /portal /reset-password /p/* | privadas | — | — | — | — | noindex | fuera del sitemap |

## Canibalización detectada

- `/guias-transformacion` vs `/blog`: si las guías no se materializan como
  lead magnets reales, consolidar en el blog (decisión de contenido, no de
  código).
- `/about` vs `/equipo`: intenciones cercanas; mantener separadas SOLO si
  /equipo crece con bios reales de autor (requisito del blog E-E-A-T).
