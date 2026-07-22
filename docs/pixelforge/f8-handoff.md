# PixelForge — Handoff post-F8 (2026-07-22)

Estado del módulo al sellar F8 (capa de QA). Escrito como punto de entrada
para quien retome el módulo (F9 u otra fase). La fuente de detalle fino es el
ledger `.claude/worktrees/pixelforge-f1/.superpowers/sdd/progress.md` (fuera
de git) y los planes en `/home/ubuntu/.claude/plans/`.

## 1. Fases cerradas (todas EN PROD)

| Fase | Qué entregó | Cierre |
|---|---|---|
| F1 Fundaciones | Proyectos, artifacts por estación, sellado/reapertura, riel | 2026-07 (1e2c867) |
| F2 Motor IA | `ai_runs`, executeOperation (guard/retry/persist), `analyze_context` | 02fbbb1 |
| F3 Estrategia | `generate_strategy` + invalidación por spec | 236904e |
| F4 Visual | Referencias (safeFetch anti-SSRF), `analyze_reference`, `synthesize_visual_dna`, R2, migración 0022 | 2026-07-16 (2a0bc1a) |
| F5 Direcciones | 3 direcciones creativas, elección/sellado, migración 0023, engine streaming | 2026-07-17 (da92860) |
| F6A Blueprint+Registry | Blueprint narrativo, registry 12 blocks, validatePageTree, PageRenderer, preview, CSP | 2026-07-18 (cc7358c vía dc2d631) |
| F6B Motion | Behaviors certificados, coreografía gobernada, reduced-motion | 2026-07-18 (119bbbf) |
| F6C Capabilities | 4 Signature Capabilities client-side certificadas | 2026-07-18 (6e59fab) |
| PF-H0/H1 | Fix crash crear→redirect | 2026-07-17 (6280921) |
| PF-X1 Product DNA | Motif La Veta, tokens `--pfx-*`, riel de forja, estación Visual reskin | 2026-07-20 (f8f4a95) |
| PF-X2 Estaciones | Reskin resto de estaciones, fix portal Select | 2026-07-21 (6d868b2) |
| F7 Composer | `compose_page_tree` e2e, `page_versions`, estación Producción, migración 0024 | 2026-07-21 (c6e7377) |
| **F8 QA** | Migración 0025, catálogo 49 checks, scoring determinista, token pfqa, qa-runner residente, 3 ops IA advisory, estación QA, human gate | **2026-07-22 (61eab8c)** |

## 2. Arquitectura vigente

- **Pipeline por estaciones**: contexto → estrategia → visual → direcciones →
  blueprint → producción (composer) → **QA (gate)** → revisión (placeholder).
  Cada estación produce un artifact sellable; reabrir invalida en cascada
  hacia abajo (`ARTIFACT_KINDS` order).
- **Motor IA** (`src/lib/pixelforge/ai/run.ts`): registro de operaciones con
  guard → buildRequest → stream → outputSchema → domainSchema (retry
  `domain_validation`) → persistResult. **CERO diff en F8** — QA advisory se
  montó encima sin tocarlo.
- **Composer (F7)**: `compose_page_tree` produce el PageTree contra el
  registry real; `checkComposerRules` en el domain schema enforcea 3–14
  nodos, footer-contact final y (desde F8) **cero anclas `#`**. Cap 32000
  tokens, reglas de concisión de copy en el prompt.
- **Render**: `validatePageTree` es LA puerta única (forma + registry +
  props + choreography); `PageRenderer` emite `data-pf-node`/`data-pf-component`
  (la superficie que mide el qa-runner). SSR completo + enhancement
  progresivo + `SectionErrorBoundary` = degradación segura (decisión F6C).
- **QA (F8)**: 3 fases — determinista/heurística in-process, navegador en el
  qa-runner residente (claim vía `claimQaBrowserJob`, watchdog 4 min), IA
  advisory (critique/originality/likeness). Scoring determinista congelado
  por run (`catalogVersion`/`scoringVersion` snapshot). Gate: `pass` sobre
  versión vigente abre solo; `pass_with_warnings` exige decisión humana;
  `openQaGate` re-verifica la versión vigente DENTRO de la tx (lock sobre la
  misma fila que `insertPageVersion` — sin ventana de carrera).

## 3. Contratos importantes

- **Token de preview QA (`?pfqa=`)**: HMAC-SHA256 sobre payload crudo, 5
  campos (`qaRunId`, `projectId`, `pageVersionId`, `ownerId`, `exp` en
  segundos epoch). El verificador exige qa_run VIVO en `running` con
  projectId/pageVersionId coincidentes. Middleware exime SOLO
  `PIXELFORGE_PREVIEW_RE` + param `pfqa` presente; el page component es el
  gate real (notFound ante token inválido). Secreto: `QA_PREVIEW_TOKEN_SECRET`
  (rotado al sellar F8).
- **`QA_INTERNAL_APP_URL`**: SIEMPRE `http://pixeltec-os:3000`. **JAMÁS
  `http://app:3000`** — el hostname `app` matchea el HSTS-preload del TLD
  `.app` embebido en Chromium → fuerza https → `ERR_SSL_PROTOCOL_ERROR`; no
  hay flag para apagarlo (verificado empíricamente). Documentado en
  `.env.production.example`.
- **Anclas internas `#`**: PROHIBIDAS en la salida del composer (QA-TE-005,
  decisión 2026-07-22). `isSafeHref` del registry las sigue aceptando a
  propósito (render de versiones viejas). Navegación interna real = capacidad
  futura con contrato explícito de ids, unicidad, a11y y validación
  renderer↔composer — NO improvisar ids en blocks.
- **`fallbackComponentId`** del registry de capabilities: contrato RESERVADO
  para el composer (decisión explícita de Miguel, F6C) — el composer lo
  ejecuta como decisión propia (D3 F7); NO existe sustitución dinámica en
  runtime.
- **IA advisory jamás bloquea**: severidad capada a minor/info,
  `blocking:false`, peso 0 en scoring. El veredicto es 100% determinista.
- **Verdict/score congelados**: NULL hasta `finalizeQaRun`, nunca se
  recalculan; findings guardan snapshot de severity/blocking del catálogo.
- **Migraciones**: SIEMPRE aditivas, aplicadas a prod vía psql en transacción
  + fila en `drizzle.__drizzle_migrations` con hash sha256 del SQL
  (patrón F4→F8). El pre-flight compara hash repo↔DB.

## 4. Infraestructura residente

- `pixeltec-os` (app Next.js standalone, puerto 3000 interno) — detrás de
  `pixeltec-nginx` (vhost pixeltec.mx). Todo deploy que recree el contenedor
  DEBE hacer `nginx -s reload` (deploy.yml ya lo incluye).
- `pixeltec-os-db` (Postgres 16, host `127.0.0.1:5437` = PROD, no hay dev
  aparte en ese puerto). Journal: 28 migraciones (última 0025).
- `pixeltec-os-qa-runner` (NUEVO en F8): imagen Playwright v1.61.1-noble
  pinneada = versión exacta de `playwright` en package.json. Endurecido:
  `pwuser`, rootfs read-only + tmpfs (/tmp, /home/pwuser), `cap_drop: ALL`,
  no-new-privileges, 2g RAM / 1.5 cpu / 512 pids, `init`, sin puertos, SOLO
  red `pixeltec-os-internal`, sin Docker socket. Healthcheck por FRESCURA del
  heartbeat (`/tmp/qa-runner-heartbeat`, umbral 360s > job timeout 4 min).
  Egress: allowlist de origin + WebSockets bloqueados + serviceWorkers block.
  Screenshots → R2 (bucket `pixeltec-os-v2-uploads`, kind `qa_screenshot`).
- Deploy: push a main → GitHub Actions → ssh al VPS → `git pull` +
  `compose build` + `up -d` + nginx reload + prune + health check.

## 5. Deuda aceptada (documentada, no bloqueante)

- T3: `getPageVersionById` lanza en vez de null ante carrera de ownership
  (hoy inalcanzable).
- T4: TOCTOU teórico del decision route — ya mitigado por `openQaGate` en tx.
- T5: `extract-copy` pierde la key al recursar arrays (hrefs sueltos en array
  no excluidos — irreal con el registry actual).
- T7: layout hace 2 fetches extra en las 8 estaciones; página QA con 4
  queries redundantes sin `React.cache`.
- Review final: claim de browser job no gateado en `current_phase` (correcto
  hoy por timing); `locationKey` de advisory con formato distinto (inocuo).
- F7: retry `domain_validation` dispara en ~4/4 composes (candidato a tuning
  de prompt); prompt cambió sin bump de `promptVersion` (sigue v1).
- Pre-F8: `build-narrative.v1.ts` tiene gap de wrap en DNA fields (EN PROD
  desde F6A) — follow-up pendiente.
- MO-006 estima con ritmo moderado como fallback.

## 6. Riesgos abiertos

- **Verdict `pass` limpio nunca observado en prod** (smoke ejercitó
  `pass_with_warnings` y `fail`; con landing de IA real no es forzable). El
  camino de gate automático por `pass` está cubierto por tests + verify
  script (check #10), no por evidencia e2e prod.
- La estación **revisión** es placeholder — el gate QA abre hacia una
  estación sin contenido (alcance F9).
- Los QA runs sobre versiones re-compuestas pueden dar FAIL honesto por
  contraste elegido por la IA (visto en smoke: v2 fail 83) — es el sistema
  funcionando, pero puede sorprender al operador.
- CF Email Obfuscation (Scrape Shield) puede meter hydration noise en
  mediciones de navegador contra el dominio público (M1, F6A) — el runner
  mide vía red interna, no aplica; solo afecta debugging manual.
- Disco del VPS al 69% (31G libres); la imagen del runner pesa ~2GB.

## 7. Backlog recomendado para F9 (espera GO — NO iniciado)

1. **Estación Revisión** (el gate QA ya deja proyectos ahí).
2. `propose_change` (D9 — excluido explícitamente de F8).
3. Navegación interna con contrato completo (ids por sección en blocks +
   composer que los use + QA-TE-005 verificando resolución real).
4. Tuning del prompt del composer (bajar la tasa de retry domain_validation;
   bump de `promptVersion`).
5. Wrap de DNA fields en `build-narrative.v1.ts` (gap heredado).
6. Lighthouse / pixel-diff / retención de screenshots (excluidos de F8).
7. Micro-limpiezas: `React.cache` en layout/página QA, hoistear
   `zoneStateForArtifact` (5 copias), `KEYFRAME_KEYS as const`.

## 8. Métricas finales

- **Tests**: 1291/1291 (vitest), tsc limpio, lint 20 hallazgos = baseline
  preexistente (delta 0 en todo F8).
- **Migraciones**: 28 aplicadas (0000–0025), hash de 0025 `de74dd51…`
  verificado repo↔DB sin divergencia.
- **Catálogo QA**: 49 checks (46 deterministas/nav/heurísticos + 3 IA
  advisory), scoring v1, catálogo v1.
- **Gates del ciclo F8**: review por tarea T1–T7 (Approved), review final
  whole-branch Opus (READY, 1 Critical cerrado en tx), selftest runner 10/10
  (también bajo hardening), verify script repos 10/10, smoke e2e desechable
  (2 bugs cazados y corregidos), **smoke prod 32/33** (único ❌ =
  expectativa de fixture, no producto), rotación de secreto verificada
  (nuevo 200 / viejo 404 / expirado 404).
- **Commits F8**: ~44 sobre c6e7377; main=origin/main=61eab8c.
