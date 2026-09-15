# Línea base GSC del home — 2026-09-14 (WO-2026-00343)

**Método:** consulta SQL de solo lectura contra las tablas sincronizadas desde Search Console
(`gsc_query_daily`, `gsc_page_daily`) en el Postgres de producción, vía
`ssh ubuntu@198.100.155.231 docker exec pixeltec-os-db psql -U pixeltec_os -d pixeltec_os`.
**Ventana:** últimos 90 días. **Datos disponibles en la tabla:** 2026-04-27 → 2026-09-11 (367 filas).
**Leída:** 2026-09-14, antes de publicar el MVP SEO del home.

## Páginas con más impresiones (90 días)

| Página | Clics | Impresiones | Posición media |
|---|---:|---:|---:|
| https://pixeltec.mx/about | 2 | 189 | 11.0 |
| https://www.pixeltec.mx/ | 11 | 183 | 21.4 |
| https://encino.pixeltec.mx/blog/maderas-para-muebles-… | 0 | 100 | 9.5 |
| **https://pixeltec.mx/** | **21** | **93** | **9.1** |
| https://pixeltec.mx/blog/ia-para-pymes-en-mexico-… | 0 | 88 | 86.5 |
| https://pixeltec.mx/equipo | 0 | 46 | 6.7 |
| https://pixeltec.mx/services | 0 | 36 | 3.1 |
| https://pixeltec.mx/industrias | 0 | 33 | 2.7 |
| https://pixeltec.mx/contact | 1 | 27 | 6.4 |

## Consultas que llegan al home (`/` y `www/`, 90 días)

| Consulta | Clics | Impresiones | Posición media |
|---|---:|---:|---:|
| pixeltec | 11 | 76 | 5.3 |
| pixel tech | 3 | 38 | 31.2 |
| pixeltech | 0 | 18 | 70.5 |
| pixel tec | 2 | 9 | 12.7 |
| (resto: `pixeltech solutions…`, `pixel tecnologia`, `pixel-tech`, `pixtec`, `pixel ti`, `pixel tech colombia`…) | 0 | 1 c/u | 3–66 |

## Lectura

**El home hoy recibe exclusivamente tráfico de marca.** Ninguna consulta no-marca aparece
asociada a `/` en 90 días: cero impresiones por «desarrollo web», «software a la medida»,
«automatización» o cualquier variante con ciudad. Las consultas no-marca del dominio caen en
otras URLs (`/services/automatizacion` → «automatización de procesos con ia», 4 impresiones;
las landings de Puerto Vallarta aparecen solo por marca).

**Consecuencia para este WO:** reescribir `title`, `description` y `H1` del home **no pone en
riesgo posiciones existentes** — no hay ranking no-marca que perder. La marca queda protegida
por los schemas `Organization`/`WebSite` (`name`, `sameAs`), que no se tocan.

**Seguimiento (MKT-003):** volver a leer esta misma consulta el **2026-09-28** y el **2026-10-14**
para medir impresiones no-marca de `/` y vigilar canibalización con las landings de ciudad.

```sql
-- Consultas del home, 90 días
select query, sum(clicks) clicks, sum(impressions) impressions,
       round((sum(position*impressions)/nullif(sum(impressions),0))::numeric, 1) as position
from gsc_query_daily
where page in ('https://pixeltec.mx/', 'https://www.pixeltec.mx/')
  and date >= current_date - 90
group by query order by impressions desc;
```
