# VPS Command Center — Backend (vps-api) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add health-monitoring and safe-action endpoints to `vps-api` so PixelTEC OS `/vps` can show a full infra snapshot and run backup/audit/restart with an audit log.

**Architecture:** vps-api (host, Express, PM2) gains a `src/health/` module (pure symptom engine + snapshot builders that take an injectable `exec`), two read routes (`/health/snapshot`, `/health/audit`), one action route (`/actions/backup`) with an append-only action log, and a reconciled project registry. PixelTEC OS consumes these via the existing `vpsClient.ts` (out of scope here — Plan 2).

**Tech Stack:** Node ≥18 (built-in `node:test`, no new deps), Express 4, existing `execAsync`/`cache`/`loadProjects`.

## Global Constraints

- Repo: `/home/ubuntu/vps-api` (git). Commit each task there. **No push** (CI disabled; gate #5).
- No new npm dependencies. Tests use the built-in `node --test` runner.
- Reuse `require("../exec").execAsync` and `TIMEOUTS`, `require("../cache")`, `require("../projects").loadProjects`.
- All new routes mount **after** `app.use(auth)` in `src/app.js` (line ~40) so they inherit dual-auth (CRON_SECRET / Bearer). Never mount under `/health/api` (that path bypasses auth).
- Shell safety: every `execAsync` call uses **fixed command strings or values from the trusted registry** (`vps-projects.json`). Never interpolate request body/query into a shell string.
- Builders accept `{ exec }` injected (default `execAsync`) so `node:test` can stub without touching the host.

---

### Task 1: Symptom engine (pure function)

The highest-value unit: given a snapshot object, return prioritized symptoms. Pure, no I/O, fully testable.

**Files:**
- Create: `src/health/symptoms.js`
- Test: `src/health/symptoms.test.js`

**Interfaces:**
- Produces: `evaluateSymptoms(snapshot) -> { symptoms: Symptom[], summary: {red,yellow,green} }`
  where `Symptom = { id, severity: "red"|"yellow"|"green", area, message, suggestedAction, evidence }`.
  `snapshot` shape is defined in Task 2 (`buildSnapshot`); this task only reads fields:
  `snapshot.disk.usedPct` (number), `snapshot.certs[] = {domain, daysLeft}`,
  `snapshot.backups = {lastRunAgeHrs, ok, coverageMissing: string[]}`,
  `snapshot.databases[] = {name, lastBackupAgeHrs}`,
  `snapshot.services[] = {id, name, status, httpOk}`,
  `snapshot.host = {ramUsedPct, load1, nproc, crashLoops: [{name,restarts}]}`,
  `snapshot.security = {securityUpdates, publicPortsOutOfPolicy: number[], sshPassword: boolean, secretsInLogs: string[]}`.

- [ ] **Step 1: Write the failing test**

```javascript
// src/health/symptoms.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { evaluateSymptoms } = require("./symptoms");

const green = {
  disk: { usedPct: 40 },
  certs: [{ domain: "a.mx", daysLeft: 60 }],
  backups: { lastRunAgeHrs: 5, ok: true, coverageMissing: [] },
  databases: [{ name: "db1", lastBackupAgeHrs: 5 }],
  services: [{ id: "s1", name: "S1", status: "running", httpOk: true }],
  host: { ramUsedPct: 40, load1: 0.3, nproc: 6, crashLoops: [] },
  security: { securityUpdates: 0, publicPortsOutOfPolicy: [], sshPassword: false, secretsInLogs: [] },
};

test("all-green snapshot yields zero red/yellow", () => {
  const { symptoms, summary } = evaluateSymptoms(green);
  assert.equal(summary.red, 0);
  assert.equal(summary.yellow, 0);
  assert.ok(symptoms.every((s) => s.severity === "green"));
});

test("disk >85% is red, cert <10d is red, ssh password is yellow", () => {
  const snap = {
    ...green,
    disk: { usedPct: 90 },
    certs: [{ domain: "a.mx", daysLeft: 7 }],
    security: { ...green.security, sshPassword: true },
  };
  const { symptoms } = evaluateSymptoms(snap);
  const byId = Object.fromEntries(symptoms.map((s) => [s.id, s]));
  assert.equal(byId.disk.severity, "red");
  assert.equal(byId["cert:a.mx"].severity, "red");
  assert.equal(byId.ssh_password.severity, "yellow");
});

test("secret in logs is always red with rotate action", () => {
  const snap = { ...green, security: { ...green.security, secretsInLogs: ["modar_bot"] } };
  const { symptoms } = evaluateSymptoms(snap);
  const s = symptoms.find((x) => x.id === "secrets_in_logs");
  assert.equal(s.severity, "red");
  assert.match(s.suggestedAction, /rotar/i);
});

test("symptoms are sorted red before yellow before green", () => {
  const snap = { ...green, disk: { usedPct: 90 }, security: { ...green.security, securityUpdates: 3 } };
  const order = { red: 0, yellow: 1, green: 2 };
  const { symptoms } = evaluateSymptoms(snap);
  for (let i = 1; i < symptoms.length; i++) {
    assert.ok(order[symptoms[i - 1].severity] <= order[symptoms[i].severity]);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/vps-api && node --test src/health/symptoms.test.js`
Expected: FAIL — `Cannot find module './symptoms'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/health/symptoms.js
"use strict";

const SEV_ORDER = { red: 0, yellow: 1, green: 2 };

function worst(...sevs) {
  return sevs.sort((a, b) => SEV_ORDER[a] - SEV_ORDER[b])[0];
}

/** @param {object} snap  @returns {{symptoms:Array,summary:{red:number,yellow:number,green:number}}} */
function evaluateSymptoms(snap) {
  const out = [];
  const push = (id, severity, area, message, suggestedAction, evidence) =>
    out.push({ id, severity, area, message, suggestedAction, evidence });

  // Disco
  {
    const p = snap.disk.usedPct;
    const sev = p > 85 ? "red" : p > 75 ? "yellow" : "green";
    push("disk", sev, "almacenamiento", `Disco al ${p}%`,
      "Limpiar Docker (build cache/imágenes), revisar logs, o ampliar disco.", { usedPct: p });
  }

  // Certificados TLS (uno por dominio)
  for (const c of snap.certs) {
    const sev = c.daysLeft < 10 ? "red" : c.daysLeft < 21 ? "yellow" : "green";
    push(`cert:${c.domain}`, sev, "tls", `Cert de ${c.domain} vence en ${c.daysLeft} días`,
      "Revisar renovación certbot (cron renew-certs.sh).", { domain: c.domain, daysLeft: c.daysLeft });
  }

  // Backups
  {
    const b = snap.backups;
    const sev = !b.ok || b.coverageMissing.length ? "red" : b.lastRunAgeHrs > 26 ? "yellow" : "green";
    push("backup", sev, "backups",
      !b.ok ? "El último backup falló"
        : b.coverageMissing.length ? `Backup sin cubrir: ${b.coverageMissing.join(", ")}`
        : `Último backup hace ${b.lastRunAgeHrs}h`,
      "Correr backup on-demand / revisar pg-backup-all.sh.", b);
  }

  // DB sin backup reciente
  for (const d of snap.databases) {
    if (d.lastBackupAgeHrs == null || d.lastBackupAgeHrs > 48) {
      push(`db_backup:${d.name}`, "red", "backups", `DB ${d.name} sin backup <48h`,
        "Añadir la DB a pg-backup-all.sh.", { db: d.name, ageHrs: d.lastBackupAgeHrs });
    }
  }

  // Servicios
  for (const s of snap.services) {
    const down = s.status !== "running" && s.status !== "paused" && s.status !== "manual";
    const sev = down ? "red" : s.httpOk === false ? "yellow" : "green";
    push(`service:${s.id}`, sev,
      "servicios", `${s.name}: ${s.status}${s.httpOk === false ? " (HTTP no OK)" : ""}`,
      "Reiniciar servicio o revisar logs.", { id: s.id, status: s.status, httpOk: s.httpOk });
  }

  // Crash-loops
  for (const c of snap.host.crashLoops) {
    const sev = c.restarts > 500 ? "red" : c.restarts > 50 ? "yellow" : "green";
    if (sev !== "green")
      push(`crashloop:${c.name}`, sev, "host", `${c.name}: ${c.restarts} reinicios`,
        "Fijar la causa raíz (ej. pin de httpx).", c);
  }

  // Seguridad
  if (snap.security.securityUpdates > 0)
    push("security_updates", "yellow", "seguridad",
      `${snap.security.securityUpdates} updates de seguridad pendientes`,
      "Aplicar en una ventana de mantenimiento.", { count: snap.security.securityUpdates });
  for (const port of snap.security.publicPortsOutOfPolicy)
    push(`port:${port}`, "red", "seguridad", `Puerto ${port} público fuera de política`,
      "Acotar en UFW a subredes/loopback.", { port });
  if (snap.security.sshPassword)
    push("ssh_password", "yellow", "seguridad", "SSH acepta contraseña",
      "Pasar a autenticación solo-llave.", {});
  if (snap.security.secretsInLogs.length)
    push("secrets_in_logs", "red", "seguridad",
      `Secreto en logs: ${snap.security.secretsInLogs.join(", ")}`,
      "Rotar el secreto y silenciar el logger.", { where: snap.security.secretsInLogs });

  // RAM / carga
  {
    const ramSev = snap.host.ramUsedPct > 95 ? "red" : snap.host.ramUsedPct > 85 ? "yellow" : "green";
    const loadSev = snap.host.load1 > snap.host.nproc ? "yellow" : "green";
    const sev = worst(ramSev, loadSev);
    push("host_load", sev, "host",
      `RAM ${snap.host.ramUsedPct}% · load ${snap.host.load1}/${snap.host.nproc}`,
      "Investigar el proceso que consume.", { ram: snap.host.ramUsedPct, load1: snap.host.load1 });
  }

  out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const summary = { red: 0, yellow: 0, green: 0 };
  for (const s of out) summary[s.severity]++;
  return { symptoms: out, summary };
}

module.exports = { evaluateSymptoms };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ubuntu/vps-api && node --test src/health/symptoms.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/vps-api
git add src/health/symptoms.js src/health/symptoms.test.js
git commit -m "feat(health): motor de síntomas puro para auditoría de salud"
```

---

### Task 2: Snapshot builders

Aggregate the raw host/service data into the `snapshot` shape the symptom engine and dashboard consume. Each section is its own function with an injectable `exec` so it's testable and one failing section degrades to a safe default instead of throwing.

**Files:**
- Create: `src/health/snapshot.js`
- Test: `src/health/snapshot.test.js`

**Interfaces:**
- Consumes: `loadProjects()` from `../projects`; `execAsync` from `../exec`.
- Produces: `buildSnapshot({ exec, projects } = {}) -> Promise<Snapshot>` with the shape read in Task 1, plus `generatedAt` (ISO string passed in or `new Date().toISOString()`), and `safe(fn, fallback)` helper exported for reuse.

- [ ] **Step 1: Write the failing test** (stubs `exec`, asserts safe-degradation + parsing)

```javascript
// src/health/snapshot.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { buildSnapshot, parseDiskLine } = require("./snapshot");

test("parseDiskLine extracts used percent", () => {
  assert.equal(parseDiskLine("97G 64G 34G 66%").usedPct, 66);
});

test("buildSnapshot degrades a failing section to a safe default, never throws", async () => {
  const exec = async (cmd) => {
    if (cmd.includes("df -h")) return { stdout: "97G 64G 34G 66%\n" };
    throw new Error("boom"); // every other section fails
  };
  const snap = await buildSnapshot({ exec, projects: [] });
  assert.equal(snap.disk.usedPct, 66);
  assert.equal(snap.host.ramUsedPct, 0); // safe fallback
  assert.ok(Array.isArray(snap.services));
  assert.ok(snap.generatedAt);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/vps-api && node --test src/health/snapshot.test.js`
Expected: FAIL — `Cannot find module './snapshot'`.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/health/snapshot.js
"use strict";

const { execAsync } = require("../exec");
const { loadProjects } = require("../projects");

async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

function parseDiskLine(line) {
  const [size, used, avail, pct] = line.trim().split(/\s+/);
  return { size, used, avail, usedPct: parseInt(pct, 10) || 0 };
}

async function buildSnapshot({ exec = execAsync, projects = loadProjects(), now } = {}) {
  const generatedAt = now || new Date().toISOString();

  const disk = await safe(async () => {
    const r = await exec("df -h / | tail -1 | awk '{print $2, $3, $4, $5}'");
    return parseDiskLine(r.stdout);
  }, { size: "?", used: "?", avail: "?", usedPct: 0 });

  const host = await safe(async () => {
    const [mem, load, nproc] = await Promise.all([
      exec("free | grep Mem | awk '{print $2, $3}'"),
      exec("cat /proc/loadavg | awk '{print $1}'"),
      exec("nproc"),
    ]);
    const [total, used] = mem.stdout.trim().split(/\s+/).map(Number);
    const crash = await safe(async () => {
      const j = JSON.parse((await exec("pm2 jlist 2>/dev/null")).stdout || "[]");
      return j.filter((p) => (p.pm2_env?.restart_time || 0) > 50)
        .map((p) => ({ name: p.name, restarts: p.pm2_env.restart_time }));
    }, []);
    return {
      ramUsedPct: total ? Math.round((used / total) * 100) : 0,
      load1: parseFloat(load.stdout.trim()) || 0,
      nproc: parseInt(nproc.stdout.trim(), 10) || 1,
      crashLoops: crash,
    };
  }, { ramUsedPct: 0, load1: 0, nproc: 1, crashLoops: [] });

  const services = await safe(async () => {
    const { getProjectStatus } = require("./services");
    return Promise.all(projects.filter((p) => p.active !== false).map((p) => getProjectStatus(p, exec)));
  }, []);

  const certs = await safe(() => require("./certs").readCerts(exec), []);
  const databases = await safe(() => require("./databases").readDatabases(exec), []);
  const backups = await safe(() => require("./backups").readBackups(exec, databases), { ok: false, lastRunAgeHrs: null, coverageMissing: [] });
  const security = await safe(() => require("./security").readSecurity(exec), { securityUpdates: 0, publicPortsOutOfPolicy: [], sshPassword: false, secretsInLogs: [] });

  return { generatedAt, disk, host, services, certs, databases, backups, security };
}

module.exports = { buildSnapshot, parseDiskLine, safe };
```

- [ ] **Step 4: Create the section modules** (each isolated; commands are fixed strings)

```javascript
// src/health/services.js  — per-project status + HTTP probe
"use strict";
const https = require("https");
function probe(domain) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 8000);
    https.get("https://" + domain, (r) => { clearTimeout(t); resolve(r.statusCode); })
      .on("error", () => { clearTimeout(t); resolve(null); });
  });
}
async function getProjectStatus(p, exec) {
  let status = "unknown";
  if (p.active === false) status = "paused";
  else if (p.type === "docker" || p.type === "docker-compose") {
    const r = await exec(`docker ps --filter name=${p.containerName} --format={{.Status}}`).catch(() => ({ stdout: "" }));
    status = r.stdout.trim() ? "running" : "stopped";
  } else if (p.type === "pm2") {
    const r = await exec("pm2 jlist 2>/dev/null").catch(() => ({ stdout: "[]" }));
    const f = JSON.parse(r.stdout || "[]").find((x) => x.name === p.pm2Name);
    status = f ? f.pm2_env.status : "stopped";
  } else if (p.type === "manual") status = "manual";
  const code = p.domain && status === "running" ? await probe(p.domain) : null;
  return { id: p.id, name: p.name, domain: p.domain || null, status, httpOk: code == null ? null : code >= 200 && code < 400, httpCode: code };
}
module.exports = { getProjectStatus };
```

```javascript
// src/health/certs.js  — days-to-expiry per live cert
"use strict";
const SSL_DIR = "/home/ubuntu/pixeltec-infra/nginx/ssl/live";
async function readCerts(exec) {
  const list = await exec(`ls -1 ${SSL_DIR}`).then((r) => r.stdout.trim().split("\n").filter(Boolean)).catch(() => []);
  const out = [];
  for (const domain of list) {
    const r = await exec(`openssl x509 -enddate -noout -in ${SSL_DIR}/${domain}/fullchain.pem 2>/dev/null | cut -d= -f2`).catch(() => null);
    if (!r || !r.stdout.trim()) continue;
    const end = new Date(r.stdout.trim());
    out.push({ domain, expiresAt: end.toISOString(), daysLeft: Math.round((end - Date.now()) / 86400000) });
  }
  return out;
}
module.exports = { readCerts };
```

```javascript
// src/health/databases.js  — sizes + last backup age per DB
"use strict";
const DUMPS = "/home/ubuntu/backups/postgres/dumps";
const HOST_DBS = { 5432: ["ardoxeo", "dalk_dev", "pixelbet", "viva_bot"], 5433: ["pixeltec_os_v2"] };
async function readDatabases(exec) {
  const dumps = await exec(`ls -1 ${DUMPS} 2>/dev/null`).then((r) => r.stdout.trim().split("\n")).catch(() => []);
  const out = [];
  for (const [port, dbs] of Object.entries(HOST_DBS)) {
    for (const db of dbs) {
      const size = await exec(`sudo -u postgres psql -p ${port} -tAc "select pg_size_pretty(pg_database_size('${db}'))" 2>/dev/null`).then((r) => r.stdout.trim()).catch(() => "?");
      out.push({ name: db, size, lastBackupAgeHrs: lastDumpAge(dumps, db) });
    }
  }
  return out;
}
function lastDumpAge(dumps, db) {
  const rx = new RegExp(`^${db}[_.].*(\\d{4}-\\d{2}-\\d{2})_(\\d{6})`);
  let newest = null;
  for (const f of dumps) {
    const m = f.match(rx);
    if (!m) continue;
    const d = new Date(`${m[1]}T${m[2].slice(0,2)}:${m[2].slice(2,4)}:${m[2].slice(4,6)}Z`);
    if (!newest || d > newest) newest = d;
  }
  return newest ? Math.round((Date.now() - newest) / 3600000) : null;
}
module.exports = { readDatabases };
```

```javascript
// src/health/backups.js  — last run + coverage + offsite flag
"use strict";
const LOG = "/home/ubuntu/backups/postgres/backup-all.log";
const OFFSITE = false; // flip to true when rclone destination is configured
async function readBackups(exec, databases = []) {
  const tail = await exec(`tail -30 ${LOG} 2>/dev/null`).then((r) => r.stdout).catch(() => "");
  const ok = /completado OK/.test(tail);
  const m = tail.match(/\[(\d{4}-\d{2}-\d{2}T[\d:+]+)\][^\n]*completado OK/);
  const lastRunAgeHrs = m ? Math.round((Date.now() - new Date(m[1])) / 3600000) : null;
  const coverageMissing = databases.filter((d) => d.lastBackupAgeHrs == null).map((d) => d.name);
  return { ok, lastRunAgeHrs, coverageMissing, offsite: OFFSITE };
}
module.exports = { readBackups };
```

```javascript
// src/health/security.js  — posture checks
"use strict";
const POLICY_PUBLIC = new Set([22, 80, 443]);
async function readSecurity(exec) {
  const ufw = await exec("sudo ufw status 2>/dev/null").then((r) => r.stdout).catch(() => "");
  const publicPortsOutOfPolicy = [...ufw.matchAll(/^(\d+)(?:\/tcp)?\s+ALLOW\s+Anywhere/gim)]
    .map((m) => parseInt(m[1], 10)).filter((p) => !POLICY_PUBLIC.has(p));
  const updates = await exec("/usr/lib/update-notifier/apt-check 2>&1 | cut -d';' -f2").then((r) => parseInt(r.stdout.trim(), 10) || 0).catch(() => 0);
  const ssh = await exec("sudo sshd -T 2>/dev/null | grep -i '^passwordauthentication'").then((r) => /yes/i.test(r.stdout)).catch(() => false);
  const secretsInLogs = [];
  for (const [unit, rx] of [["modar_bot", "bot[0-9]+:"], ["PDF-Manager", "bot[0-9]+:"]]) {
    const hit = await exec(`journalctl -u ${unit} -n 5 --no-pager 2>/dev/null | grep -cE "${rx}" || true`).then((r) => parseInt(r.stdout.trim(), 10) || 0).catch(() => 0);
    if (hit > 0) secretsInLogs.push(unit);
  }
  return { securityUpdates: updates, publicPortsOutOfPolicy: [...new Set(publicPortsOutOfPolicy)], sshPassword: ssh, secretsInLogs };
}
module.exports = { readSecurity };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /home/ubuntu/vps-api && node --test src/health/snapshot.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Smoke against the real host** (no test, just confirm shape)

Run: `cd /home/ubuntu/vps-api && node -e "require('./src/health/snapshot').buildSnapshot().then(s=>console.log(JSON.stringify(s,null,1).slice(0,800)))"`
Expected: real JSON with `disk.usedPct`, `services[]`, `certs[]`, `databases[]`, `backups`, `security` populated.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/vps-api
git add src/health/snapshot.js src/health/snapshot.test.js src/health/services.js src/health/certs.js src/health/databases.js src/health/backups.js src/health/security.js
git commit -m "feat(health): builders de snapshot por sección con degradación segura"
```

---

### Task 3: Read routes `/health/snapshot` and `/health/audit`

**Files:**
- Create: `src/routes/healthSnapshot.js`
- Modify: `src/app.js` (add two mounts after `app.use(auth)`, ~line 49 near the existing `/health` mount)

**Interfaces:**
- Consumes: `buildSnapshot` (Task 2), `evaluateSymptoms` (Task 1), `getCached/setCached` from `../cache`.
- Produces: `GET /health/snapshot -> Snapshot` (cached 30s), `GET /health/audit -> {symptoms,summary,generatedAt}` (uncached).

- [ ] **Step 1: Write the route**

```javascript
// src/routes/healthSnapshot.js
const express = require("express");
const router = express.Router();
const { getCached, setCached } = require("../cache");
const { buildSnapshot } = require("../health/snapshot");
const { evaluateSymptoms } = require("../health/symptoms");

const KEY = "vps:health:snapshot";

router.get("/snapshot", async (req, res, next) => {
  try {
    const cached = getCached(KEY);
    if (cached) return res.json(cached);
    const snap = await buildSnapshot();
    setCached(KEY, snap, 30_000);
    res.json(snap);
  } catch (e) { next(e); }
});

router.get("/audit", async (req, res, next) => {
  try {
    const snap = await buildSnapshot();
    res.json({ ...evaluateSymptoms(snap), generatedAt: snap.generatedAt });
  } catch (e) { next(e); }
});

module.exports = router;
```

- [ ] **Step 2: Mount in `src/app.js`** (after `app.use("/health", require("./routes/health"));`, line ~49)

```javascript
app.use("/health", require("./routes/healthSnapshot"));
```

- [ ] **Step 3: Verify both endpoints on the live host**

Run:
```bash
cd /home/ubuntu/vps-api && node src/server.js & sleep 2
SECRET=$(grep '^CRON_SECRET=' /home/ubuntu/pixeltec-os/.env.production | cut -d= -f2)
curl -s -H "Authorization: Bearer $SECRET" http://127.0.0.1:3005/health/snapshot | head -c 300; echo
curl -s -H "Authorization: Bearer $SECRET" http://127.0.0.1:3005/health/audit | head -c 300; echo
kill %1
```
Expected: snapshot JSON, then audit JSON with `summary:{red,yellow,green}`. (Note: `Authorization: Bearer` only works if `GITHUB_DEPLOY_SECRET`==that value; otherwise use the CRON_SECRET query/header the existing routes accept — check `src/auth.js` for the exact accepted form and mirror `status` route's auth in the curl.)

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/vps-api
git add src/routes/healthSnapshot.js src/app.js
git commit -m "feat(health): rutas /health/snapshot (cache 30s) y /health/audit"
```

---

### Task 4: Action log + `POST /actions/backup`

**Files:**
- Create: `src/actionLog.js`, `src/actionLog.test.js`, `src/routes/actions.js`
- Modify: `src/app.js` (mount `/actions` after auth)

**Interfaces:**
- Produces: `appendAction({ actor, action, target, result })` → writes one JSON line to `/home/ubuntu/logs/vps-actions.log`, returns the entry with `ts`. `POST /actions/backup` → `{ ok, durationMs, tail }`.

- [ ] **Step 1: Write the failing test** (log formatting, injectable path/writer)

```javascript
// src/actionLog.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { formatEntry } = require("./actionLog");

test("formatEntry stamps ts and preserves fields", () => {
  const e = formatEntry({ actor: "miguel", action: "backup", target: "all", result: "ok" }, "2026-07-13T00:00:00Z");
  assert.equal(e.ts, "2026-07-13T00:00:00Z");
  assert.equal(e.actor, "miguel");
  assert.equal(e.action, "backup");
  assert.equal(JSON.parse(JSON.stringify(e)).result, "ok");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ubuntu/vps-api && node --test src/actionLog.test.js`
Expected: FAIL — `Cannot find module './actionLog'`.

- [ ] **Step 3: Implement**

```javascript
// src/actionLog.js
"use strict";
const fs = require("fs");
const path = require("path");
const LOG = "/home/ubuntu/logs/vps-actions.log";

function formatEntry(input, now) {
  return { ts: now || new Date().toISOString(), actor: input.actor || "unknown", action: input.action, target: input.target || null, result: input.result };
}
function appendAction(input, logPath = LOG) {
  const entry = formatEntry(input);
  try { fs.mkdirSync(path.dirname(logPath), { recursive: true }); fs.appendFileSync(logPath, JSON.stringify(entry) + "\n"); } catch (e) { /* logging must never break the action */ }
  return entry;
}
module.exports = { appendAction, formatEntry };
```

```javascript
// src/routes/actions.js
const express = require("express");
const router = express.Router();
const { execAsync, TIMEOUTS } = require("../exec");
const { appendAction } = require("../actionLog");

router.post("/backup", async (req, res, next) => {
  const actor = (req.body && req.body.actor) || "crm";
  const started = Date.now();
  try {
    const r = await execAsync("/home/ubuntu/scripts/pg-backup-all.sh 2>&1 | tail -20", { timeout: TIMEOUTS.deploy, maxBuffer: 5 * 1024 * 1024 });
    const durationMs = Date.now() - started;
    appendAction({ actor, action: "backup", target: "all-databases", result: "ok" });
    res.json({ ok: true, durationMs, tail: r.stdout.trim() });
  } catch (e) {
    appendAction({ actor, action: "backup", target: "all-databases", result: "error: " + e.message });
    res.status(500).json({ ok: false, error: e.message, tail: (e.stdout || "").trim() });
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount in `src/app.js`** (after the `/health` mounts)

```javascript
app.use("/actions", require("./routes/actions"));
```

- [ ] **Step 5: Run unit test + live backup**

Run: `cd /home/ubuntu/vps-api && node --test src/actionLog.test.js`
Expected: PASS.
Then (live, creates a real dump — safe/idempotent):
```bash
SECRET=$(grep '^CRON_SECRET=' /home/ubuntu/pixeltec-os/.env.production | cut -d= -f2)
cd /home/ubuntu/vps-api && node src/server.js & sleep 2
curl -s -X POST -H "Authorization: Bearer $SECRET" -H "Content-Type: application/json" -d '{"actor":"test"}' http://127.0.0.1:3005/actions/backup | head -c 300; echo
kill %1
tail -1 /home/ubuntu/logs/vps-actions.log
```
Expected: `{ "ok": true, ... }` and a JSON line in the action log.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/vps-api
git add src/actionLog.js src/actionLog.test.js src/routes/actions.js src/app.js
git commit -m "feat(actions): POST /actions/backup con log de auditoría de acciones"
```

---

### Task 5: Reconcile the project registry (10 → 17)

`vps-projects.json` omits active services, so the dashboard would hide clients. Add the missing entries so `loadProjects()` returns all real services. **Do not** change the runtime behavior of existing entries.

**Files:**
- Modify: `/home/ubuntu/vps-projects.json`

- [ ] **Step 1: List real services vs registry**

Run:
```bash
docker ps --format '{{.Names}}'; pm2 jlist | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c).on('end',()=>JSON.parse(d).forEach(p=>console.log('pm2:'+p.name)))"
node -e "require('/home/ubuntu/vps-api/src/projects').loadProjects().forEach(p=>console.log(p.id, p.containerName||p.pm2Name))"
```
Expected: a diff — real services (villa-nogal-app, transportes-sanchez, velank-app, smile-more, pipas-container, edmsolar, PDF-Manager, viva-bot, modar_bot/pixelbet as applicable) missing from the registry.

- [ ] **Step 2: Add each missing entry** following the exact existing shape (id, name, desc, type, path, domain, active, pm2Name|null, containerName|null, deployCmd, restartCmd, stopCmd, startCmd). Copy the pattern from a sibling of the same `type` already in the file (e.g. `barrostock` for docker-compose apps). Back up first:

```bash
cp /home/ubuntu/vps-projects.json /home/ubuntu/backups/vps-projects.json.bak-$(node -e "console.log(Date.now())")
```

- [ ] **Step 3: Validate JSON + loadProjects count**

Run: `node -e "console.log(require('/home/ubuntu/vps-api/src/projects').loadProjects().length)"`
Expected: count matches the real service inventory (~17), no parse error.

- [ ] **Step 4: Restart vps-api so it serves the reconciled registry**

Run: `pm2 restart vps-api && sleep 2 && pm2 logs vps-api --lines 5 --nostream`
Expected: clean start, no registry errors.

- [ ] **Step 5: Commit** (registry lives outside a repo; back it up — no git). Record the change in the session notes and NeuroPIXEL infra doc (Plan 3 / Entregable 2).

---

## Self-Review

**Spec coverage:** Panels 1-7 → snapshot builders (Task 2) + symptom thresholds (Task 1); Actions 8-11 → `/actions/backup` (Task 4), `/health/audit` report (Task 3), restart/pause/logs (pre-existing, unchanged); action log (Task 4); registry reconcile (Task 5). Dashboard (§Componente 4) and vault doc (§Entregable 2) are **out of scope for this plan** — they are Plan 2 and Plan 3 (see below). Backup offsite is a documented dependency, `offsite:false` flag wired in `backups.js` ready to flip.

**Placeholder scan:** none — all steps carry real code/commands.

**Type consistency:** `evaluateSymptoms(snapshot)` reads exactly the fields `buildSnapshot` produces (disk.usedPct, certs[].daysLeft, backups.{ok,lastRunAgeHrs,coverageMissing}, databases[].lastBackupAgeHrs, services[].{status,httpOk}, host.{ramUsedPct,load1,nproc,crashLoops}, security.{securityUpdates,publicPortsOutOfPolicy,sshPassword,secretsInLogs}). Route returns match the shapes consumed by Plan 2.

## Follow-on plans (not this file)

- **Plan 2 — Dashboard** (`pixeltec-os` `/vps`): consume `/health/snapshot` + `/health/audit`, render the 7 panels + symptom report, wire the Backup/Audit/restart action buttons through `vpsClient.ts` with the existing confirm dialog. Vitest for the report view; manual E2E.
- **Plan 3 — Vault doc** (`NeuroPIXEL/01_CONTEXT/infraestructura.md`): operación de VPS multi-cliente (aislamiento, seguridad, backups 3-2-1, monitoreo, runbooks). Propose before commit; no push.
