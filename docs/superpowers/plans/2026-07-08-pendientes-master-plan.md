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

Piezas de Firebase que quedaron fuera a propósito y siguen pendientes:

1. **Portal legado de clientes** (`src/app/portal/*`, Firebase Auth client-side) — decidir
   alcance: ¿migrar su datastore a Postgres (ya migrado en Fase 3/4 parcialmente —
   `clients`/`updates`/`projects` del portal ya están en Postgres) y su auth a NextAuth
   también, o dejarlo en Firebase Auth indefinidamente por ser superficie client-facing?
2. **Firebase Storage** (avatares de perfil, logos de Growth) — decidir si migrar a
   S3/R2/Supabase Storage (Postgres solo guarda la URL, nunca reemplaza blob storage) o
   mantenerlo.
3. **Pipeline de IA con Genkit** (`src/ai/*`, tool `firestore-context` referenciado desde
   `app/actions.ts`) — auditar qué datos toca exactamente antes de decidir alcance.
4. **Retiro final de Firebase** — una vez 1-3 estén resueltos: quitar `firebase`/
   `firebase-admin` de deps, verificar `grep -rn "firebase" src` sin resultados de
   datastore/auth, limpiar env vars.

Cada una de estas es su propia decisión de alcance — no se arranca ninguna sin que Miguel
elija por dónde empezar, mismo patrón que WhatsApp Inbox/Crypto-Intel.

---

## Bloque 3 — Decisiones de infra/seguridad pendientes (independientes de Bloque 1)

Estas no bloquean ni son bloqueadas por el deploy de Bloque 1 — se pueden resolver en
paralelo, son decisiones puntuales:

1. **Nginx — HSTS duplicado.** Confirmado en producción (`pixeltec-os/nginx/nginx.conf` es
   un archivo viejo sin uso real; el nginx real monta config desde
   `pixeltec-infra/nginx/`, compartido por ~13 sitios de otros clientes). Pendiente:
   ¿tocar el snippet compartido `security-headers.conf` (afecta a todos los clientes) o
   dejarlo para una sesión dedicada con más contexto de ese repo?
2. **Backup de purga de git** — considerar borrar
   `~/backups/pixeltec-os-PRE-PURGE-backup-20260707-011929.git` (23M, historial viejo con
   secretos ya rotados) una vez Miguel confirme que la purga quedó bien.
3. **GitHub Support** — refs de PRs viejos (`refs/pull/1..39/head`) siguen teniendo los
   commits con secretos (ya rotados) recuperables por SHA directo. Bajo riesgo; contactar
   soporte de GitHub si se quiere cerrar del todo.
4. **`TELEGRAM_CHAT_ID`** — si se quiere restaurar `sendTelegramNotification` (usado en el
   `NotesLog.tsx` que se borró en Fase 4 por no tener consumidores — revisar si todavía
   aplica).

---

## Bloque 4 — Backlog de producto (sin apuro, no bloqueante)

1. Redirects 302→301 del IA redesign (`next.config.ts`) — ya estable, pendiente de aplicar.
2. WhatsApp Inbox — follow-ups menores no bloqueantes: banner de pausa expirada, dedupe en
   `ListEditor`, `pausedUntil` pasado aceptado sin validar.
3. **Growth Suite**: `growthCredits`/`growthBrands`/`growthPosts`/`growthCampaigns`/`growthJobs`
   de Firestore no están en el script de migración (tablas Postgres vacías) — decidir si
   migrar datos reales (si los hay) o empezar de cero, dado que el dashboard "no opera
   realmente" según Miguel.
4. Auditoría legal externa — aviso de privacidad v2 (LFPDPPP).
5. Hardening binding `127.0.0.1` — pipas-container (3001) + webhook (9000, falta HTTPS y HMAC).

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
