# Informe semanal de Search Console

Carpeta destino de `scripts/seo/gsc-weekly-report.ts` (WO-2026-00345, L5). Los
informes generados (`YYYY-Www.md`) **no se versionan** salvo que Miguel lo pida:
son lecturas de datos que ya viven en `gsc_query_daily`, no conocimiento nuevo.
Este README y el script sí.

## Qué produce

Un markdown con fecha y ventanas (28 días actuales vs. 28 anteriores, terminando
en hoy − `GSC_LAG_DAYS`) y seis secciones, siempre las mismas y en este orden:

1. **Quick wins** — consulta×página con posición media 4–15 e impresiones ≥ piso
   (`DEFAULT_THRESHOLDS.minImpressions`, 100), sin marca, ordenadas por
   impresiones, con la acción sugerida (título/H1/párrafo + enlace interno).
2. **CTR bajo** — posición ≤ 5 y CTR por debajo del esperable de `rules.ts`
   (`ruleImproveCtr`): acción title/description, no el cuerpo.
3. **Consultas nuevas** — en la ventana actual y ausentes en la anterior, ≥ 5 impr.
4. **Páginas** — top 20 por impresiones con delta de impresiones/clics y posición.
5. **Cobertura** — landings (`CONTENT_LANDING_PATHS`) y páginas de industria con
   0 impresiones en la ventana actual.
6. **Canibalización** — consultas con ≥ 2 páginas distintas en el top 20 (vigilar
   home vs. landings PV y `/industrias/hoteles` vs. `/desarrollo-web-puerto-vallarta`).

## Cómo correrlo

```bash
# A) Sin SSH ni DB — CSV exportado de Search Console (Rendimiento → Consultas → Exportar → CSV):
npm run seo:gsc-weekly -- --csv ~/Downloads/Consultas.csv --out docs/seo/gsc-weekly/2026-W38.md
#    Con dos exportaciones (ventana actual y anterior) salen deltas y consultas nuevas:
npm run seo:gsc-weekly -- --csv actual.csv --prev anterior.csv --out docs/seo/gsc-weekly/2026-W38.md

# B) En el VPS, contra la base de datos (misma NODE_OPTIONS que `npm test`):
cd /home/ubuntu/pixeltec-os && docker compose exec -T app npm run seo:gsc-weekly -- --from-db --out /tmp/2026-W38.md
#    Si la imagen no incluye scripts/ o tsx: exporta a CSV con psql y usa --csv:
#    \copy (select date, page, query, clicks, impressions, ctr, position from gsc_query_daily
#           where site_id='pixeltec.mx' and date >= current_date - 60) to '/tmp/gsc.csv' csv header

# Opciones: --ends-on YYYY-MM-DD · --min-impressions N · --json
```

## CSV esperado

- **Largo** (recomendado; es lo que devuelve `psql` o `--json` de este script):
  `date,page,query,clicks,impressions,ctr,position`, una fila por día.
- **Nativo de Search Console** (`Consultas principales,Clics,Impresiones,CTR,Posición`
  o `Páginas principales,…`, en español o inglés, separador `,` o `;`, `12,5 %` o
  `12.5%`): sin fecha ni cruce consulta×página. Sirve para quick wins, CTR bajo y
  (con `--prev`) consultas nuevas; las secciones por página exigen el CSV largo o
  `--from-db`, y el informe lo dice en su cabecera.

Fixture de referencia y pruebas: `scripts/seo/fixtures/gsc-sample.csv`,
`scripts/seo/gsc-weekly-report.test.ts`.

## Qué hacer con el resultado

Cada lunes: leer las secciones 1, 2 y 6; elegir **3 quick wins** y registrarlos
como pendientes fechados en `NeuroPIXEL/09_SEGUIMIENTO/Pixeltec.mx.md`; los
cambios de title/description entran por WorkOrder normal. No reaccionar a
fluctuaciones de días (guía operativa §7).
