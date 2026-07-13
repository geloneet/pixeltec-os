# VPS Command Center — Dashboard (`/vps`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rebuild the `/vps` page in PixelTEC OS into a command center that renders the 7 health panels + prioritized symptom report and exposes safe actions (backup, audit, restart/pause), consuming the already-deployed `vps-api` endpoints.

**Architecture:** `/vps` (React) → `vpsClient.ts` (server-side, CRM admin session) → `vps-api` `GET /health/snapshot`, `GET /health/audit`, `POST /actions/backup`, plus existing restart/pause/logs. All reads go through one server action that calls the snapshot endpoint; the page polls it ~30s (matches the API cache).

**Tech Stack:** Next.js (App Router), React, existing `vpsClient.ts`, vitest for the symptom-report view, existing `/vps` components (`status-dot`, `project-card`, `server-stats-header`, `logs-sheet`, `action-confirm-dialog`).

## Global Constraints

- Repo: `/home/ubuntu/pixeltec-os` (git). Commit each task. **No push** (gate #5).
- Reuse the existing `/vps` components; do not restyle the app — follow the current dark theme and the patterns already in `vps-dashboard.tsx`.
- All vps-api calls go through `src/lib/vpsClient.ts` (it already validates the CRM session and holds the vps-api auth secret). Do NOT call vps-api directly from client components.
- **vps-api auth:** vpsClient already authenticates correctly (the existing `/vps` page works). The new endpoints are behind the same middleware — no auth change needed. (For reference, vps-api accepts `?secret=VPS_API_SECRET` or `Authorization: Bearer GITHUB_DEPLOY_SECRET` — vpsClient handles this.)
- Actions are behind the existing `action-confirm-dialog`; nothing destructive.
- `npx tsc --noEmit`, `npm run lint`, `npm test` must pass.

---

### Task 1: Server actions for snapshot + audit + backup

**Files:**
- Modify: `src/lib/vpsClient.ts` (add typed helpers if not present)
- Create: `src/app/(admin)/vps/actions.ts` (server actions)
- Test: `src/app/(admin)/vps/actions.test.ts` (vitest, mocking vpsClient)

**Interfaces:**
- Produces: `getHealthSnapshot(): Promise<Snapshot>`, `getHealthAudit(): Promise<AuditReport>`, `runBackup(): Promise<{ok:boolean; durationMs:number; tail:string}>`. Types mirror the vps-api shapes (Snapshot per the backend spec; AuditReport = `{symptoms: Symptom[], summary:{red,yellow,green}, generatedAt}`).

- [ ] **Step 1:** Write `actions.test.ts` mocking `vpsClient` to return a fixed snapshot/audit and asserting the server actions pass through the parsed object and surface errors as `{error}` rather than throwing to the client. (Full test code: mock `vpsRequest` to resolve a canned `{summary:{red:1,yellow:0,green:5}, symptoms:[...]}` and assert `getHealthAudit()` returns it.)
- [ ] **Step 2:** Run `npm test src/app/(admin)/vps/actions.test.ts` — FAIL (module missing).
- [ ] **Step 3:** Implement `actions.ts` — each function calls the matching vpsClient path (`/health/snapshot`, `/health/audit`, `/actions/backup` POST) with `requireSession` already enforced inside vpsClient; define the TS types for Snapshot/Symptom/AuditReport in `src/app/(admin)/vps/types.ts`.
- [ ] **Step 4:** Run the test — PASS.
- [ ] **Step 5:** Commit.

### Task 2: Symptom report view (the "reporte de síntomas")

**Files:**
- Create: `src/app/(admin)/vps/components/symptom-report.tsx`
- Test: `src/app/(admin)/vps/components/symptom-report.test.tsx`

**Interfaces:**
- Consumes: `AuditReport` from Task 1.
- Produces: `<SymptomReport report={AuditReport} />` rendering symptoms grouped/sorted 🔴→🟡→🟢, each row showing `message`, `area`, and `suggestedAction`; a header with the red/yellow/green counts.

- [ ] **Step 1:** Write `symptom-report.test.tsx` (vitest + testing-library): given a report with 1 red + 1 yellow, assert red renders before yellow, the counts show, and each `suggestedAction` is visible. (Full test code included.)
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `SymptomReport` using the existing dark-theme classes (mirror `status-dot` colors: red/amber/green). No new deps.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit.

### Task 3: The 7 panels in the dashboard

**Files:**
- Modify: `src/app/(admin)/vps/vps-dashboard.tsx`
- Create: `src/app/(admin)/vps/components/health-panels.tsx` (the 7 panels: host, disk-breakdown, services-by-client, databases, certs, backups, security)

**Interfaces:**
- Consumes: `Snapshot` from Task 1; reuses `server-stats-header`, `project-card`, `status-dot`.

- [ ] **Step 1:** Fetch the snapshot in `vps-dashboard.tsx` via `getHealthSnapshot()` on mount + a 30s interval (matches API cache). Render `<HealthPanels snapshot={...} />`.
- [ ] **Step 2:** Implement `health-panels.tsx` — one section per panel. Services panel reuses `project-card` with the new `httpOk`/`status` fields; disk shows the breakdown; databases show size + last-backup-age with a warning color when `lastBackupAgeHrs>26`/null; certs show `daysLeft` with amber `<21`/red `<10`; backups show ok + coverage + `offsite` flag; security shows the posture counts. Each panel is presentational (no logic beyond formatting).
- [ ] **Step 3:** `npx tsc --noEmit` + `npm run lint` clean.
- [ ] **Step 4:** Commit.

### Task 4: Action bar (backup, audit, restart/pause) with confirmation

**Files:**
- Modify: `src/app/(admin)/vps/vps-dashboard.tsx`, `src/app/(admin)/vps/components/project-actions.tsx`
- Reuse: `action-confirm-dialog.tsx`

- [ ] **Step 1:** Add a top action bar: **Backup** (calls `runBackup()`, shows a spinner + the returned `tail`), **Auditoría de salud** (calls `getHealthAudit()` and opens `<SymptomReport>` in a sheet/modal). Both behind `action-confirm-dialog` where they mutate.
- [ ] **Step 2:** Per-service restart/pause/resume already exist in `project-actions.tsx` — confirm they still work against the reconciled registry (15 services incl. pdf-manager pm2, modar-bot manual). No change unless the new `manual`-type entries need a disabled action state (a `manual` service can't be pm2/docker-restarted from the existing action — hide or relabel the restart button for `type:"manual"`).
- [ ] **Step 3:** Manual E2E in the running dev server + `npm test`.
- [ ] **Step 4:** Commit.

### Task 5: (Follow-up, optional) systemd status for `manual` services

The backend `services.js` reports `manual` for systemd services (modar_bot, pixelbet) — no real health. If real crash-detection for these matters, add a small `systemd` branch to `vps-api` `src/health/services.js` (`systemctl is-active <unit>`) and a `type:"systemd"` in the registry. This is a separate small backend change (its own TDD task + review + deploy), not required for the dashboard to ship.

## Verification

- `npx tsc --noEmit -p .`, `npm run lint`, `npm test` green.
- Run the dev server; open `/vps`: 7 panels populated from live data, symptom report matches `curl /health/audit` (currently red:5/yellow:2/green:27), Backup button returns ok + tail, restart/pause work per service.
- Confirm the page degrades gracefully if vps-api is briefly unreachable (shows last data / an error banner, doesn't crash).

## Self-Review

- Spec coverage: 7 panels (Task 3), symptom report/audit (Task 2+4), backup action (Task 4), restart/pause/logs (existing, verified Task 4). Registry now 15 services incl. the 2 bots.
- Placeholder scan: fill the actual test code + panel JSX at implementation time (this plan names the files, shapes, and reuse targets; the implementer writes the concrete TSX following `vps-dashboard.tsx` patterns).
- Dependency: backend endpoints are DEPLOYED (main @ 3df2ccb) — this plan consumes live APIs.
