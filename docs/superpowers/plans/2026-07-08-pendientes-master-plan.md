# Plan maestro — pendientes de pixeltec-os (2026-07-08)

**Estado:** PLAN (no ejecutado). Consolida todo lo pendiente disperso en memoria +
conversación: deploys acumulados, resto de Fase 5, decisiones de infra, y backlog de
producto. Cada bloque requiere su propio OK explícito de Miguel antes de actuar.

---

## Contexto — por qué este plan existe ahora

`main` en pixeltec-os sigue en `1700b78` (deploy del 2026-07-07: theme mode Fase 1 +
remediación de seguridad). Desde entonces se acumularon en working tree, **sin commitear
ni desplegar**:
- **147 archivos** en pixeltec-os: Fases 0-4 completas de la migración Firebase→Postgres
  (NextAuth real, CRM, documentos, notificaciones, perfil, blog, growth, funnel — ver
  memoria "Fase 4 COMPLETA"), Fase 5 rebanada 1 (WhatsApp Inbox → pixelbot HTTP), y la
  migración de Crypto-Intel a Postgres.
- **23 archivos** en pixelbot: Fase A+C de WhatsApp Inbox (endpoints de lectura +
  retiro completo de la proyección Firestore).

Todo esto está **verificado con pruebas reales** (tsc/build limpios, Playwright con sesión
real, datos reales migrados y confirmados 1:1 contra Firestore) pero nada está en git ni
en producción. Mientras más crece este working tree sin desplegar, más riesgo de
conflictos y más lejos está `main` de lo que el dashboard realmente hace hoy en dev.

---

## Bloque 1 — LA DECISIÓN QUE DESBLOQUEA TODO: commit + deploy de lo acumulado

**Por qué va primero:** todo el código nuevo (WhatsApp Inbox, Crypto-Intel) ya asume que
NextAuth/Postgres (Fase 2) están activos — `getSessionUid()`, `requireAdmin()`, etc. No se
puede desplegar una pieza sin las demás; **es un solo release atómico**, no algo que se
pueda trocear más de lo que ya está.

**Orden de deploy (crítico — ver el gate documentado en `firestore.rules` y en memoria):**
1. Commitear el trabajo acumulado (sugerido: varios commits agrupados por fase para que el
   historial cuente la historia real — Fase 0+1, Fase 2, Fase 3, Fase 4, WhatsApp Inbox
   Fase A/B/C, Crypto-Intel — en vez de un solo commit gigante).
2. Backup de la SQLite de pixelbot (mismo patrón que deploys anteriores).
3. Deploy de **pixelbot** primero (`docker compose build --no-cache && up -d
   --force-recreate` — el mismo working tree ya tiene Fase A+C juntas: agrega los
   endpoints de lectura Y retira la proyección Firestore en el mismo cambio).
4. Deploy de **pixeltec-os** inmediatamente después (mismo patrón `build --no-cache +
   force-recreate + nginx reload`) — el dashboard deja de leer Firestore para WhatsApp
   Inbox y empieza a hacer polling contra pixelbot.
5. Deploy de **`firestore.rules`** (`firebase deploy --only firestore:rules`) — cierra
   `tenants/**` a `allow read, write: if false`.
6. **Los pasos 3-5 deben quedar lo más juntos posible en el tiempo** — si `firestore.rules`
   se despliega antes que el código, o si pixelbot se despliega mucho antes que
   pixeltec-os, el WhatsApp Inbox real se rompe para los usuarios (ver nota en el propio
   archivo `firestore.rules`).

**Verificación post-deploy** (mismo patrón que deploys anteriores — `rtk proxy curl` para
respuestas crudas, no el curl normal que pasa por el resumen de rtk):
- `/api/health` 200, login NextAuth real funciona, rutas protegidas 307 sin sesión.
- `/whatsapp`: conversaciones cargan por polling, cero llamadas a Firestore para
  `tenants/**` (solo el listener de notas `whatsappContacts`, que es correcto).
- `/crypto-intel` y `/crypto-intel/admin`: cargan, sync/evaluar manual funcionan.
- Logs de pixelbot y pixeltec-os sin errores en los primeros minutos.
- `mode_audit_log` y `crypto_intel_logs` reciben filas nuevas con el uso real.

**Riesgo/rollback:** cada pieza es independiente a nivel de contenedor — si algo falla,
revertir el contenedor específico a la imagen anterior. La `firestore.rules` puede
revertirse sola con otro `firebase deploy` si hiciera falta abrir `tenants/**` de emergencia.

---

## Bloque 2 — Resto de Fase 5 (después de Bloque 1)

Piezas de Firebase que quedaron fuera a propósito:

1. **Portal legado de clientes** — DIFERIDO A PROPÓSITO (2026-07-08). Investigado a fondo:
   no hay forma de crear cuentas dentro de la app (Firebase Console manual, sin
   documentar), escala chica, y migrar su auth requeriría un rol/tabla nuevo en Postgres +
   decidir mecanismo (password vs OTP) + plan de migración de cuentas existentes. Miguel
   decidió tratarlo como fase separada, no mezclar con WhatsApp/Crypto-Intel. Ver sección
   dedicada en memoria (`project_state.md`) para el detalle completo, incluida una
   corrección real al Decision 6 de este mismo plan (el portal legado sigue en Firebase
   Auth, a diferencia de `/[slug]` y `/portal/[token]`) y el hallazgo de que
   `finances`/`tickets` en Postgres son solo una foto fija de Fase 3, sin repo/query real.
2. **Firebase Storage** (avatares de perfil, logos de Growth) — **PENDIENTE, baja
   prioridad, deliberadamente pospuesto (2026-07-08).** Decidir si migrar a S3/R2/Supabase
   Storage (Postgres solo guarda la URL, nunca reemplaza blob storage) o mantenerlo.
   **Por qué se pospone:** ni avatares ni logos de Growth son código muerto ni tienen un
   problema de seguridad activo — es trabajo de infraestructura sin urgencia, y Miguel
   quiere priorizar valor de producto (Bloque 4) sobre esto. **Sin dependencia oculta con
   Bloque 4**: verificado que `src/lib/growth/storage/brands.ts` sí usa Firebase Storage
   (`getStorage` de `firebase-admin/storage`) para logos de marca, pero la decisión de
   Growth Suite en Bloque 4 (qué hacer con `growthCredits`/`Brands`/`Posts`/`Campaigns`/`Jobs`
   de Firestore) es sobre DATOS, no sobre el blob storage — los logos se quedan en Firebase
   Storage de cualquier forma (mismo patrón ya aceptado para avatares de perfil en Fase 4),
   así que decidir Growth Suite no requiere resolver esto primero.
3. **Pipeline de IA con Genkit** — HECHO (2026-07-08). Auditado a fondo: `firestore-context`
   nunca tocó Firestore real (mock hardcodeado, código Admin SDK comentado) y todo
   `src/ai/*` estaba huérfano (sin UI que lo usara). Encontrado además un gap de seguridad
   real (sin `requireAdmin()` en ninguna de sus 4 server actions). Miguel decidió borrar
   los 15 archivos + el componente `AIAdvisor.tsx` huérfano + las deps de genkit, en vez de
   mantenerlo "por si algún día". Ver memoria para el detalle completo.
4. **Retiro final de Firebase** — sigue bloqueado por el ítem 2 (Firebase Storage) y
   crypto-intel/WhatsApp/pixelbot ya migrados (ver Bloque 1). No arrancar hasta que 2 esté
   resuelto.

---

## Bloque 3 — Decisiones de infra/seguridad pendientes (independientes de Bloque 1)

**HECHO (2026-07-08)**, salvo el ítem 3:

1. **Nginx — HSTS duplicado.** RESUELTO y verificado en vivo. No era solo HSTS —
   X-Frame-Options/X-Content-Type-Options/Referrer-Policy también se duplicaban (mismo
   valor, inofensivo) y **Permissions-Policy tenía valores distintos** entre la app y
   nginx. Fix: snippet nuevo `security-headers-app-hsts.conf` scoped SOLO a
   `pixeltec.mx.conf`, sin tocar el snippet compartido — verificado que los otros 12 sitios
   siguen exactamente igual. Ver memoria para el detalle. **Nota**: `pixeltec-infra` tiene
   este fix aplicado en vivo pero sin commitear (mezclado con otro trabajo ajeno de una
   sesión previa) — Miguel decide cuándo commitear ese repo.
2. **Backup de purga de git** — BORRADO (Miguel confirmó).
3. **GitHub Support** — **PENDIENTE, baja prioridad, deliberadamente pospuesto
   (2026-07-08).** Refs de PRs viejos (`refs/pull/1..39/head`) siguen teniendo los commits
   con secretos (ya rotados) recuperables por SHA directo. Bajo riesgo real (secretos ya
   rotados) — requiere que Miguel mismo contacte soporte de GitHub (no es algo ejecutable
   por mí). Sin dependencia con Bloque 4 — es aislado (higiene de historial de git, no
   afecta nada en ejecución).
4. **`TELEGRAM_CHAT_ID`** — Miguel confirmó que no hace falta restaurar
   `sendTelegramNotification`. Cerrado, sin acción.
5. **`firestore.rules` — hardening de `/clients`** (encontrado durante la investigación
   del portal legado, no estaba en el plan original): cualquier usuario autenticado podía
   leer/escribir los datos de cualquier cliente. Cerrado con ownership real por
   `contactEmail`, desplegado y verificado que los 10 clientes reales no se rompen.

---

## Bloque 4 — Backlog de producto (sin apuro, no bloqueante)

1. **Redirects 302→301** — HECHO (ya estaba resuelto). Verificado línea por línea en
   `next.config.ts`: todos los redirects del IA redesign ya tienen `permanent: true`. Nada
   que hacer.
2. **WhatsApp Inbox — 3 follow-ups menores** — HECHO (2026-07-08), verificado con Playwright
   contra datos reales (no solo tsc/build): banner de pausa expirada (`ChatThread.tsx`,
   `ContactPanel.tsx` — nuevo estado `pausedExpired` comparando `pausedUntil` contra
   `Date.now()`), dedupe en `ListEditor` (`BotConfigView.tsx` — mismo patrón que ya usaba
   `ContactPanel`'s tags), `pausedUntil` pasado ahora rechazado con 400 en
   `/api/whatsapp-inbox/mode/route.ts`. Los 3 confirmados en vivo: seteé un `pausedUntil`
   pasado directo en la SQLite de pixelbot-dev y el banner cambió correctamente; probé
   agregar el mismo item 2 veces en `ListEditor` y solo quedó 1; probé `POST` directo con
   `pausedUntil` pasado y devolvió 400.
3. **Growth Suite (datos)** — HECHO, resuelto sin migrar nada. Investigación con query real
   confirmó **0 documentos** en las 5 colecciones de Firestore
   (`growthCredits`/`Brands`/`Posts`/`Campaigns`/`Jobs`, + `growthCreditLedger`) — nunca se
   creó una sola marca, post, campaña o crédito. Las páginas de `/crecimiento` ya leen
   Postgres exclusivamente (sin residuos de Firestore). `growthSocialAccounts` (las únicas
   con datos reales, 3 cuentas OAuth) ya están migradas 1:1. "Empezar de cero" ya es la
   realidad de hoy — no había nada que decidir.
   **Bug real encontrado de paso (no estaba en el backlog) y corregido**:
   `uploadBrandLogo` (`src/lib/growth/storage/brands.ts`) llamaba `.bucket()` sin nombre —
   el Admin SDK aquí se inicializa sin `storageBucket` por defecto, así que la función
   **probablemente nunca subió un logo exitosamente** (explica en parte por qué
   `growthBrands` está vacío). Corregido pasando `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   explícito (mismo patrón que avatares) + agregado el borrado del logo anterior antes de
   subir uno nuevo (evita huérfanos si cambia la extensión, o si se sube bajo
   `brandId='temp'` antes de guardar la marca). Verificado con una subida real: PNG luego
   SVG para la misma marca → queda exactamente 1 archivo, no 2.
4. Auditoría legal externa — aviso de privacidad v2 (LFPDPPP).
5. **Hardening binding `127.0.0.1`** — HECHO (2026-07-08), mucho más grande de lo esperado.
   pipas/webhook ya estaban cerrados desde antes (memoria desactualizada). Investigando el
   resto del VPS apareció un incidente de seguridad real: `dalk-db-dev` (Postgres de otro
   cliente) expuesto a internet por el bypass Docker/ufw — corregido. Y en `/opt/botsAR/`,
   varios bots de carding (fraude con tarjetas) activos, incluido uno corriendo en vivo —
   detenidos y puestos en cuarentena por instrucción explícita de Miguel. Ver memoria
   (`project_state.md`, sección "Bloque 4 — Hardening de bindings") para el detalle
   completo. **Pendiente para Miguel** (no ejecutable por mí): decidir si borra
   permanentemente la cuarentena y si reporta el hallazgo a alguna autoridad.

---

## Secuencia recomendada

1. **Bloque 1 primero** — desbloquea todo lo demás y reduce el riesgo de un working tree
   de 170 archivos sin desplegar. Es la decisión de mayor apalancamiento ahora mismo.
2. **Bloque 3 en paralelo** — son decisiones puntuales de Miguel que no dependen de nada
   de lo anterior, se pueden resolver en cualquier momento.
3. **Bloque 2 después de Bloque 1** — cada pieza de Fase 5 restante requiere elegir alcance
   antes de empezar, mismo patrón que las rebanadas ya hechas.
4. **Bloque 4 cuando haya tiempo** — ninguna de estas es urgente ni bloquea nada.

**Regla que sigue vigente para todo esto:** ningún deploy a producción ni ninguna nueva
rebanada de Fase 5 arranca sin el OK explícito de Miguel en el momento — este documento es
el mapa, no la autorización.
