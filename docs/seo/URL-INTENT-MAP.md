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

## Landings por keyword (WO-2026-00189)

26 URL nuevas: 13 keywords × (genérica + Puerto Vallarta). Plan y ángulos en
`docs/seo/plan-posicionamiento-puerto-vallarta-2026-09.md` §2. Registro tipado
en `src/lib/content/keyword-landings*.ts`; los `page.tsx` los genera
`scripts/gen-keyword-landing-pages.mjs` (no se editan a mano). Estado `creada`
= registro + ruta + sitemap en la rama `feature/seo-landings-puerto-vallarta`;
`crear` = pendiente de las partes 2 y 3 del WorkOrder.

| URL | Tipo | Intención | Keyword principal [Hipótesis] | Funnel | CTA | Estado |
|---|---|---|---|---|---|---|
| /empresas-de-desarrollo-de-software | landing keyword | investigación comercial | empresas de desarrollo de software | consideration | contacto | crear |
| /empresas-de-desarrollo-de-software-puerto-vallarta | landing keyword local | investigación comercial local | empresas de desarrollo de software puerto vallarta | consideration | contacto | crear |
| /programador-de-software | landing keyword | investigación comercial | programador de software | consideration | contacto | crear |
| /programador-de-software-puerto-vallarta | landing keyword local | investigación comercial local | programador de software puerto vallarta | consideration | contacto | crear |
| /sistemas-a-medida | landing keyword | informacional → comercial | sistemas a medida | awareness→consideration | diagnóstico | crear |
| /sistemas-a-medida-puerto-vallarta | landing keyword local | informacional → comercial local | sistemas a medida puerto vallarta | awareness→consideration | diagnóstico | crear |
| /software-a-medida-para-empresas | landing keyword | investigación comercial | software a medida para empresas | consideration | contacto | crear |
| /software-a-medida-para-empresas-puerto-vallarta | landing keyword local | investigación comercial local | software a medida para empresas puerto vallarta | consideration | contacto | crear |
| /sistema-personalizado-para-empresas | landing keyword | investigación comercial | sistema personalizado para empresas | consideration | contacto | crear |
| /sistema-personalizado-para-empresas-puerto-vallarta | landing keyword local | investigación comercial local | sistema personalizado para empresas puerto vallarta | consideration | contacto | crear |
| /automatiza-tu-negocio | landing keyword | informacional → comercial | automatiza tu negocio | awareness→consideration | diagnóstico | creada |
| /automatiza-tu-negocio-puerto-vallarta | landing keyword local | informacional → comercial local | automatiza tu negocio puerto vallarta | awareness→consideration | diagnóstico | creada |
| /automatizar-mensajes-de-whatsapp | landing keyword | informacional → transaccional | automatizar mensajes de whatsapp | consideration | contacto | creada |
| /automatizar-mensajes-de-whatsapp-puerto-vallarta | landing keyword local | informacional → transaccional local | automatizar mensajes de whatsapp puerto vallarta | consideration | contacto | creada |
| /automatizar-whatsapp-business | landing keyword | informacional comparativa | automatizar whatsapp business | consideration | contacto | creada |
| /automatizar-whatsapp-business-puerto-vallarta | landing keyword local | informacional comparativa local | automatizar whatsapp business puerto vallarta | consideration | contacto | creada |
| /automatizacion-de-mensajes-en-whatsapp | landing keyword | investigación comercial | automatizacion de mensajes en whatsapp | consideration→decision | contacto | creada |
| /automatizacion-de-mensajes-en-whatsapp-puerto-vallarta | landing keyword local | investigación comercial local | automatizacion de mensajes en whatsapp puerto vallarta | consideration→decision | contacto | creada |
| /desarrolladores-de-app | landing keyword | investigación comercial | desarrolladores de app | consideration | contacto | crear |
| /desarrolladores-de-app-puerto-vallarta | landing keyword local | investigación comercial local | desarrolladores de app puerto vallarta | consideration | contacto | crear |
| /desarrollo-de-app | landing keyword | informacional → comercial | desarrollo de app | awareness→consideration | contacto | crear |
| /desarrollo-de-app-puerto-vallarta | landing keyword local | informacional → comercial local | desarrollo de app puerto vallarta | awareness→consideration | contacto | crear |
| /desarrolladores-de-apps | landing keyword | investigación comercial | desarrolladores de apps | consideration | contacto | crear |
| /desarrolladores-de-apps-puerto-vallarta | landing keyword local | investigación comercial local | desarrolladores de apps puerto vallarta | consideration | contacto | crear |
| /desarrollo-de-aplicaciones-moviles | landing keyword | informacional → comercial | desarrollo de aplicaciones moviles | awareness→consideration | contacto | crear |
| /desarrollo-de-aplicaciones-moviles-puerto-vallarta | landing keyword local | informacional → comercial local | desarrollo de aplicaciones moviles puerto vallarta | awareness→consideration | contacto | crear |

### Riesgo de canibalización dentro de los clústeres

- Clúster B (WhatsApp): `automatizar-mensajes-de-whatsapp`,
  `automatizar-whatsapp-business` y `automatizacion-de-mensajes-en-whatsapp`
  son casi sinónimas. Se separan por ángulo (mecánica y reglas de Meta · app
  vs. API · casos por industria e indicadores) y se enlazan entre sí. Si en GSC
  dos de ellas compiten por la misma consulta, se consolida con 301 —decisión
  de Miguel con datos, no antes.
- Clúster C (apps): mismo riesgo entre `desarrolladores-de-app` y
  `desarrolladores-de-apps`; vigilar desde la primera lectura de GSC.
