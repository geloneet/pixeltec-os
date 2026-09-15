# Estrategia de contenidos — 90 días

Objetivo comercial: leads calificados para servicios high-ticket (ecosistemas
web, automatización con IA, PixelBot) desde búsqueda orgánica, medidos en el
CRM propio del OS (no se instala GA4 en este incremento).

Audiencia: dueños y responsables de operación de PyMEs mexicanas (foco
occidente/Puerto Vallarta) que evalúan digitalizar o automatizar procesos.

## Pilares (validar/ratificar con Miguel antes del primer calendario)

1. **Ecosistemas web que operan negocios** → /services/ecosistemas-web
2. **Automatización e IA aplicada (sin humo)** → /services/automatizacion, /diagnostico
3. **PixelBot y atención conversacional** → /pixelbot
4. **Casos y decisiones técnicas de PixelTEC** → evidencia E-E-A-T transversal

Cada pilar: página pilar (servicio) + artículos de apoyo enlazados en ambos
sentidos + CTA contextual + señal de éxito (leads con esa fuente en el CRM).

## Cadencia (sujeta a capacidad real de revisión experta — no inflar)

- 2 artículos sólidos y revisados / mes.
- 1 optimización sustancial de contenido existente / mes.
- 1 caso de estudio real / trimestre (pilar 4).
- Revisión trimestral de páginas de servicio.
- Los 2 artículos existentes (IA para PyMEs, curso IA gratis) entran al ciclo
  de optimización: fuentes verificadas, keyword declarada, enlaces a servicios.

## Primeros briefs propuestos (crear con el formulario estratégico — NO
generar en lote; uno por vez, con fuentes y experiencia propia)

| # | Tema (borrador) | Pilar | Intención | Nota |
|---|---|---|---|---|
| 1 | Cuánto cuesta realmente automatizar un proceso en una PyME (rangos honestos) | 2 | commercial-investigation | trade-offs reales de proyectos PixelTEC |
| 2 | WhatsApp Business API vs bot casero: qué conviene a una PyME | 3 | commercial-investigation | conecta a /pixelbot |
| 3 | Excel como sistema operativo del negocio: cuándo sí y cuándo migrar | 1 | informational | experiencia PixelStudio/CRM |
| 4 | Checklist: qué pedirle a una agencia antes de firmar un desarrollo | 1 | commercial-investigation | E-E-A-T + confianza |
| 5 | Caso: de operación manual a portal de clientes (anonimizado y aprobado) | 4 | consideration | requiere aprobación del cliente |
| 6 | Diagnóstico de madurez digital: cómo leer el resultado | 2 | transactional | alimenta /diagnostico |

Temas se derivan de: servicios reales, preguntas de clientes en el funnel,
decisiones técnicas del repo/vault, y (cuando exista) Search Console. Nunca de
tendencias ajenas al negocio.

## Clusters de los artículos publicados → servicio o landing objetivo (auditoría 2026-09-14, WO-2026-00345)

Fuente: HTML vivo de los 5 posts publicados (enlaces internos del cuerpo y del bloque
«Recursos de PixelTEC mencionados»). Lo que es DATO (cuerpo, `internalLinks`,
`metaTitle`) lo corrige Miguel en `/blog-cms`; lo que es código (fallback por
categoría en `src/lib/blog/cluster-map.ts`) ya está en producción desde L3.

| Post | Cluster (query objetivo) | Debe enlazar a | Estado del dato |
|---|---|---|---|
| agente-de-ia-en-whatsapp-para-mi-negocio | «agente de IA en WhatsApp» | /pixelbot · /automatizar-whatsapp-business · /automatizacion-puerto-vallarta | falta la landing de WhatsApp |
| como-automatizar-procesos-manuales-en-mi-negocio-guia-real | «cómo automatizar procesos» | /automatiza-tu-negocio · /services/automatizacion | falta la landing automatiza-tu-negocio |
| ia-para-pymes-en-mexico-guia-honesta… | «IA para pymes» | /services/automatizacion · /automatiza-tu-negocio · /diagnostico | sin ningún enlace interno: cubierto por el fallback hasta que se cargue `internalLinks` |
| que-datos-nunca-deberias-compartir-con-chatgpt… | «privacidad IA empresa» | /services/consultoria · /pixelbot | `metaTitle` truncado en la DB + enlace 404 `/blog/como-tomar-un-curso-de-ia-gratis` (CMS) |
| sistema-administrativo-para-eficientar-tu-pyme | «sistema administrativo pyme» | /software-a-medida-para-empresas · /sistemas-a-medida · /services/ecosistemas-web | hoy apunta a automatización (cluster equivocado) |

Regla de código: `relatedResourcesFor(categoría, etiquetas, internalLinks)` devuelve ≤ 3
destinos existentes (servicio + landing + herramienta) y no repite lo que el post ya
trae; las etiquetas con «WhatsApp» empujan /pixelbot al frente. El test comprueba
cada href contra los registros reales.

## Reglas

- Un brief sin fuentes NI experiencia propia declarada no se genera.
- Nada se publica sin pasar el gate (revisión humana incluida).
- KPI mensual: clics no-branded, páginas indexadas, leads orgánicos del CRM,
  artículos actualizados. "Posición media" no es KPI único.
