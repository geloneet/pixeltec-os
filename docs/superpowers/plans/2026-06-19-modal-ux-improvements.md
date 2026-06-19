# Modal UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve 6 CRM modals to reduce form-fatigue, clarify purpose, and enable faster data entry — without touching Firestore or type schemas.

**Architecture:** All modal JSX lives in `renderModal()` inside `CRMShellProvider.tsx`. The `title`, `subtitle`, and `content` variables are set per `modal.type` in a switch. A new `submitLabel` variable will make button text dynamic. One modal (addTask) also needs its trigger in `ProjectView.tsx` updated to pass context data.

**Tech Stack:** Next.js 14 App Router, React (hooks + refs), Tailwind CSS, shadcn/ui-style components, Firebase (untouched)

## Global Constraints

- NO Firestore writes changed
- NO new fields added to `CRMTask`, `CRMProject`, `CRMClient`, `RecurringCharge`, or `CRMKey` interfaces in `/src/types/crm.ts`
- NO new logic, hooks, or context values
- All changes are purely JSX / CSS / UX
- Keep the existing `formRefs` ref-based pattern for reading form values
- Do NOT add controlled state for individual fields — use the same DOM-mutation pattern as the existing color picker (lines 530–548 of `CRMShellProvider.tsx`)
- `submitLabel` defaults to `"Guardar"` so unmodified modals are unaffected

## Priority Value Mapping (read-only, do not change `crm.ts`)

| Stored prio value | New display label |
|---|---|
| `urgent_important` | 🔴 Crítica |
| `important` | 🟠 Importante |
| `urgent` | 🟡 Normal |
| `low` | 🟢 Baja |

---

## File Map

| File | Role |
|---|---|
| `src/components/crm/CRMShellProvider.tsx` | Contains ALL modal JSX — all tasks modify this |
| `src/components/crm/ProjectView.tsx` | Triggers addTask modal — Task 4 adds context data here |

---

### Task 1: Dynamic submit button label

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:294–296` (variable declarations section)
- Modify: `src/components/crm/CRMShellProvider.tsx:682` (submit button text)

**Interfaces:**
- Produces: `submitLabel` variable (string) used by all subsequent tasks

- [ ] **Step 1: Add `submitLabel` to the variable block**

In `renderModal()`, the current variable block (lines 295–297) is:
```tsx
let title = "";
let subtitle: string | undefined;
let content: ReactNode = null;
```

Change to:
```tsx
let title = "";
let subtitle: string | undefined;
let content: ReactNode = null;
let submitLabel = "Guardar";
```

- [ ] **Step 2: Wire `submitLabel` into the submit button**

Find the submit button (lines 679–684):
```tsx
<button
  onClick={handleModalSubmit}
  className="px-4 py-2 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] transition-all duration-150"
>
  Guardar
</button>
```

Replace `Guardar` with `{submitLabel}`:
```tsx
<button
  onClick={handleModalSubmit}
  className="px-4 py-2 text-sm bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] transition-all duration-150"
>
  {submitLabel}
</button>
```

- [ ] **Step 3: Verify no runtime errors**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 type errors for this change (or same errors as before — do not introduce new ones).

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(modals): add dynamic submitLabel variable for per-modal button text"
```

---

### Task 2: Modal "Nuevo cliente" — two-column layout + subtitle + button

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:300–346` (addClient/editClient case)

**Interfaces:**
- Consumes: `submitLabel` from Task 1
- Produces: Visual two-column form; subtitle for addClient; "Crear cliente" button

- [ ] **Step 1: Replace the addClient/editClient case body**

Find the case starting at line 300:
```tsx
case "addClient":
case "editClient": {
  title = modal.type === "addClient" ? "Nuevo cliente" : "Editar cliente";
  content = (
    <div className="space-y-3">
      ...
    </div>
  );
  break;
}
```

Replace with:
```tsx
case "addClient":
case "editClient": {
  title = modal.type === "addClient" ? "Nuevo cliente" : "Editar cliente";
  if (modal.type === "addClient") {
    subtitle = "Crea una nueva cuenta para gestionar proyectos, tareas y recursos.";
    submitLabel = "Crear cliente";
  }
  content = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1">Nombre *</label>
          <input
            ref={ref("name")}
            className={inputClass + " font-medium"}
            defaultValue={modal.data?.name || ""}
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Teléfono</label>
          <input
            ref={ref("phone")}
            className={inputClass}
            placeholder="+52 55 1234 5678"
            defaultValue={modal.data?.phone || ""}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            ref={ref("email")}
            type="email"
            className={inputClass}
            placeholder="cliente@empresa.com"
            defaultValue={modal.data?.email || ""}
          />
        </div>
        <div>
          <label className={labelClass}>Ubicación</label>
          <input
            ref={ref("location")}
            className={inputClass}
            placeholder="Ciudad de México"
            defaultValue={modal.data?.location || ""}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Notas <span className="text-zinc-600">(opcional)</span>
        </label>
        <textarea
          ref={ref("notes")}
          className={inputClass + " h-16 resize-none"}
          defaultValue={modal.data?.notes || ""}
        />
      </div>
    </div>
  );
  break;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(modals/cliente): two-column layout, subtitle, Crear cliente button"
```

---

### Task 3: Modal "Editar proyecto" — two-column + placeholders + tech chips + button

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:348–419` (addProject/editProject case)

**Interfaces:**
- Consumes: `submitLabel` from Task 1
- Produces: Two-column General/Finanzas sections; tech chips visual; "Actualizar proyecto" button for editProject

- [ ] **Step 1: Replace the addProject/editProject case body**

Find the case at line 348:
```tsx
case "addProject":
case "editProject": {
  title = modal.type === "addProject" ? "Nuevo proyecto" : "Editar proyecto";
  content = (
    <div className="space-y-3">
      ...
    </div>
  );
  break;
}
```

Replace with:
```tsx
case "addProject":
case "editProject": {
  title = modal.type === "addProject" ? "Nuevo proyecto" : "Editar proyecto";
  if (modal.type === "editProject") submitLabel = "Actualizar proyecto";
  content = (
    <div className="space-y-3">
      <p className={sectionLabel}>General</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Nombre *</label>
          <input
            ref={ref("name")}
            className={inputClass}
            defaultValue={modal.data?.name || ""}
            autoFocus
          />
        </div>
        <div>
          <label className={labelClass}>Dominio</label>
          <input
            ref={ref("domain")}
            className={inputClass}
            placeholder="midominio.com"
            defaultValue={modal.data?.domain || ""}
          />
        </div>
      </div>
      <p className={sectionLabel}>Finanzas</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Presupuesto</label>
          <input
            ref={ref("budget")}
            className={inputClass}
            placeholder="$50,000 MXN"
            defaultValue={modal.data?.budget || ""}
          />
        </div>
        <div>
          <label className={labelClass}>Costos anuales</label>
          <input
            ref={ref("annual")}
            className={inputClass}
            placeholder="$6,000 MXN / año"
            defaultValue={modal.data?.annual || ""}
          />
        </div>
      </div>
      <p className={sectionLabel}>Recursos</p>
      <div>
        <label className={labelClass}>Tecnologías</label>
        <input
          ref={ref("tech")}
          className={inputClass}
          placeholder="React, Node.js, Firebase"
          defaultValue={modal.data?.tech || ""}
        />
        {modal.data?.tech && modal.data.tech.trim() && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {modal.data.tech
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 text-[11px] text-zinc-300 bg-zinc-800 rounded-full border border-zinc-700"
                >
                  {t}
                </span>
              ))}
          </div>
        )}
      </div>
      {modal.type === "editProject" && (
        <>
          <div>
            <label className={labelClass}>Cuentas</label>
            <textarea
              ref={ref("accounts")}
              className={inputClass + " h-20 resize-none"}
              defaultValue={modal.data?.accounts || ""}
            />
          </div>
          <div>
            <label className={labelClass}>Guías</label>
            <textarea
              ref={ref("guides")}
              className={inputClass + " h-20 resize-none"}
              defaultValue={modal.data?.guides || ""}
            />
          </div>
        </>
      )}
    </div>
  );
  break;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(modals/proyecto): two-column layout, placeholders, tech chips, Actualizar button"
```

---

### Task 4: Modal "Nueva tarea" — context banner + priority chips + Enter submit + button

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:421–445` (addTask case)
- Modify: `src/components/crm/ProjectView.tsx:476` (modal trigger — add client/project names)

**Interfaces:**
- Consumes: `submitLabel` from Task 1; `handleModalSubmit` from outer scope of `renderModal()`
- Produces: Context banner (when data present); emoji priority chip selector; Enter-to-submit; "Crear tarea" button

- [ ] **Step 1: Update the addTask trigger in ProjectView.tsx to pass context**

In `ProjectView.tsx` line 476, find:
```tsx
onClick={() => setModal({ type: "addTask" })}
```

Replace with:
```tsx
onClick={() => setModal({ type: "addTask", data: { clientName: client.name, projectName: project.name } })}
```

Note: `client` and `project` are already destructured at line 167 of this file.

- [ ] **Step 2: Replace the addTask case body in CRMShellProvider.tsx**

Find the case at line 421:
```tsx
case "addTask": {
  title = "Nueva tarea";
  content = (
    <div className="space-y-3">
      ...
    </div>
  );
  break;
}
```

Replace with:
```tsx
case "addTask": {
  title = "Nueva tarea";
  submitLabel = "Crear tarea";
  content = (
    <div className="space-y-3">
      {modal.data?.clientName && (
        <div className="flex items-center gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500">
          <span>
            Cliente:{" "}
            <span className="font-medium text-zinc-300">{modal.data.clientName}</span>
          </span>
          <span className="text-zinc-700">·</span>
          <span>
            Proyecto:{" "}
            <span className="font-medium text-zinc-300">{modal.data.projectName}</span>
          </span>
        </div>
      )}
      <div>
        <label className={labelClass}>Nombre *</label>
        <input
          ref={ref("name")}
          className={inputClass}
          placeholder="Configurar webhook Stripe"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleModalSubmit();
            }
          }}
        />
      </div>
      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          ref={ref("desc")}
          className={inputClass + " h-16 resize-none"}
          placeholder="Pasos, contexto o enlaces necesarios para completar la tarea."
        />
      </div>
      <div>
        <label className={labelClass}>Prioridad</label>
        <input type="hidden" ref={ref("prio")} defaultValue="important" />
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {(
            [
              { value: "urgent_important", emoji: "🔴", label: "Crítica" },
              { value: "important", emoji: "🟠", label: "Importante" },
              { value: "urgent", emoji: "🟡", label: "Normal" },
              { value: "low", emoji: "🟢", label: "Baja" },
            ] as const
          ).map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              data-prio-btn={value}
              onClick={() => {
                const el = formRefs.current["prio"] as HTMLInputElement | null;
                if (el) el.value = value;
                document.querySelectorAll("[data-prio-btn]").forEach((btn) => {
                  (btn as HTMLElement).style.outline = "none";
                  (btn as HTMLElement).style.background = "";
                });
                const target = document.querySelector(
                  `[data-prio-btn="${value}"]`,
                ) as HTMLElement | null;
                if (target) target.style.outline = "2px solid rgba(14,165,233,0.7)";
              }}
              className="flex flex-col items-center gap-0.5 px-1 py-2 rounded-lg text-xs text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/60 transition-all"
              style={{
                outline: value === "important" ? "2px solid rgba(14,165,233,0.7)" : "none",
                outlineOffset: "2px",
              }}
            >
              <span className="text-base">{emoji}</span>
              <span className="text-[10px] text-zinc-400">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  break;
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx src/components/crm/ProjectView.tsx
git commit -m "feat(modals/tarea): context banner, priority chips, Enter submit, Crear tarea button"
```

---

### Task 5: Modal "Nueva llave" — show/hide value + placeholders + help text + button

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:447–461` (addKey case)

**Interfaces:**
- Consumes: `submitLabel` from Task 1; `formRefs` from outer scope
- Produces: Placeholder suggestions for label; password-type value field with toggle button; help text; "Guardar credencial" button

- [ ] **Step 1: Replace the addKey case body**

Find the case at line 447:
```tsx
case "addKey": {
  title = "Nueva llave";
  content = (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Etiqueta</label>
        <input ref={ref("label")} className={inputClass} autoFocus />
      </div>
      <div>
        <label className={labelClass}>Valor</label>
        <input ref={ref("value")} className={inputClass} />
      </div>
    </div>
  );
  break;
}
```

Replace with:
```tsx
case "addKey": {
  title = "Nueva llave";
  submitLabel = "Guardar credencial";
  content = (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500 leading-relaxed">
        Guarda tokens, API keys, contraseñas o datos técnicos relevantes para este proyecto.
      </div>
      <div>
        <label className={labelClass}>Etiqueta</label>
        <input
          ref={ref("label")}
          className={inputClass}
          placeholder="OPENAI_API_KEY"
          autoFocus
        />
        <div className="flex gap-1.5 mt-1.5">
          {["OPENAI_API_KEY", "Token WhatsApp Cloud", "Stripe Secret Key"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                const el = formRefs.current["label"] as HTMLInputElement | null;
                if (el) { el.value = s; el.focus(); }
              }}
              className="px-2 py-0.5 text-[10px] text-zinc-500 bg-zinc-800/60 hover:bg-zinc-700 rounded-md transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Valor{" "}
          <span className="text-zinc-600">(dato sensible)</span>
        </label>
        <div className="relative">
          <input
            ref={ref("value")}
            type="password"
            className={inputClass + " pr-10"}
            placeholder="sk-proj-xxxx..."
          />
          <button
            type="button"
            onClick={() => {
              const el = formRefs.current["value"] as HTMLInputElement | null;
              if (el) el.type = el.type === "password" ? "text" : "password";
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
            title="Mostrar / ocultar"
          >
            👁
          </button>
        </div>
      </div>
    </div>
  );
  break;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(modals/llave): show/hide value, label suggestions, help text, Guardar credencial button"
```

---

### Task 6: Modal "Editar README" → "Documentación del proyecto" — title + help + template + height + button

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:463–473` (editReadme case)

**Interfaces:**
- Consumes: `submitLabel` from Task 1
- Produces: Renamed modal, markdown help panel, starter template when empty, taller editor, "Actualizar documentación" button

- [ ] **Step 1: Replace the editReadme case body**

Find the case at line 463:
```tsx
case "editReadme": {
  title = "Editar README";
  content = (
    <textarea
      ref={ref("content")}
      className={inputClass + " h-64 resize-none font-mono text-xs"}
      defaultValue={modal.data?.content || ""}
      autoFocus
    />
  );
  break;
}
```

Replace with:
```tsx
case "editReadme": {
  title = "Documentación del proyecto";
  submitLabel = "Actualizar documentación";
  const readmeTemplate = `# Descripción\n\n## Objetivo\n\n## Tecnologías\n\n## Configuración\n\n## Notas importantes`;
  content = (
    <div className="space-y-2">
      <textarea
        ref={ref("content")}
        className={inputClass + " h-80 resize-y font-mono text-xs leading-relaxed"}
        defaultValue={modal.data?.content || readmeTemplate}
        autoFocus
      />
      <div className="rounded-lg border border-white/[0.04] bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-600">
        <p className="mb-1 font-medium text-zinc-500">Soporta Markdown</p>
        <pre className="font-mono leading-relaxed whitespace-pre-wrap">{`# Títulos  ## Secciones  - Listas\n\`\`\`bash\nnpm install\n\`\`\``}</pre>
      </div>
    </div>
  );
  break;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(modals/readme): rename to Documentación, template, taller editor, Actualizar button"
```

---

### Task 7: Modal "Nuevo cobro recurrente" — subtitle + suggestions + format + summary + label + button

**Files:**
- Modify: `src/components/crm/CRMShellProvider.tsx:558–615` (addCharge/editCharge case)

**Interfaces:**
- Consumes: `submitLabel` from Task 1; `formRefs` from outer scope
- Produces: Subtitle for addCharge; concept quick-pick buttons; $ prefix on amount; dynamic next-charge summary span; "(opcional)" on email label; "Crear cobro recurrente" button

- [ ] **Step 1: Replace the addCharge/editCharge case body**

Find the case at line 558:
```tsx
case "addCharge":
case "editCharge": {
  title = modal.type === "addCharge" ? "Nuevo cobro recurrente" : "Editar cobro";
  content = (
    <div className="space-y-3">
      ...
    </div>
  );
  break;
}
```

Replace with:
```tsx
case "addCharge":
case "editCharge": {
  title = modal.type === "addCharge" ? "Nuevo cobro recurrente" : "Editar cobro";
  if (modal.type === "addCharge") {
    subtitle = "Programa recordatorios automáticos para servicios recurrentes.";
    submitLabel = "Crear cobro recurrente";
  }
  const updateChargeDate = () => {
    const freqEl = formRefs.current["frequency"] as HTMLSelectElement | null;
    const dateEl = formRefs.current["startDate"] as HTMLInputElement | null;
    const span = document.getElementById("charge-next-date");
    if (!freqEl || !dateEl || !span || !dateEl.value) {
      if (span) span.textContent = "—";
      return;
    }
    const d = new Date(dateEl.value + "T12:00:00");
    if (isNaN(d.getTime())) { span.textContent = "—"; return; }
    if (freqEl.value === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    span.textContent = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  content = (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Concepto *</label>
        <input
          ref={ref("concept")}
          className={inputClass}
          placeholder="Hosting anual, Mantenimiento mensual, Dominio .mx"
          defaultValue={modal.data?.concept || ""}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {["Hosting", "Dominio", "VPS", "Mantenimiento", "Licencia", "Otro"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                const el = formRefs.current["concept"] as HTMLInputElement | null;
                if (el) { el.value = s; el.focus(); }
              }}
              className="px-2 py-1 text-[11px] text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700 rounded-md transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass}>Monto (MXN) *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 pointer-events-none">
            $
          </span>
          <input
            ref={ref("amount")}
            type="number"
            className={inputClass + " pl-6"}
            placeholder="15,000"
            defaultValue={modal.data?.amount || ""}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Frecuencia *</label>
          <select
            ref={ref("frequency")}
            className={inputClass}
            defaultValue={modal.data?.frequency || "annual"}
            onChange={updateChargeDate}
          >
            <option value="monthly">Mensual</option>
            <option value="annual">Anual</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Fecha de inicio *</label>
          <input
            ref={ref("startDate")}
            type="date"
            className={inputClass}
            defaultValue={modal.data?.startDate || ""}
            onChange={updateChargeDate}
          />
        </div>
      </div>
      <div className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-500">
        Próximo cobro estimado:{" "}
        <span id="charge-next-date" className="font-medium text-zinc-300">
          —
        </span>
      </div>
      <div>
        <label className={labelClass}>
          Email del cliente{" "}
          <span className="text-zinc-600">(opcional)</span>
        </label>
        <input
          ref={ref("clientEmail")}
          type="email"
          className={inputClass}
          placeholder="cliente@empresa.com"
          defaultValue={modal.data?.clientEmail || ""}
        />
      </div>
    </div>
  );
  break;
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/ubuntu/pixeltec-os && npx tsc --noEmit 2>&1 | head -30
```
Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/CRMShellProvider.tsx
git commit -m "feat(modals/cobro): subtitle, concept chips, $ prefix, next-charge summary, Crear button"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task | Status |
|---|---|---|
| Nuevo cliente: subtítulo | Task 2 | ✅ |
| Nuevo cliente: 2 columnas Nombre\|Teléfono / Email\|Ubicación | Task 2 | ✅ |
| Nuevo cliente: Notas al final | Task 2 | ✅ |
| Nuevo cliente: mayor peso visual a Nombre | Task 2 (`font-medium` label + input) | ✅ |
| Nuevo cliente: botón "Crear cliente" | Tasks 1+2 | ✅ |
| Nueva tarea: botón "Crear tarea" | Tasks 1+4 | ✅ |
| Nueva tarea: prioridad con chips visuales | Task 4 | ✅ |
| Nueva tarea: Fecha límite | ⚠️ Out of scope — CRMTask has no `dueDate` field; adding it would violate "NO modificar esquemas". The second spec supersedes. | — |
| Nueva tarea: Enter para submit | Task 4 | ✅ |
| Nueva tarea: contexto Cliente/Proyecto | Task 4 | ✅ |
| Nueva tarea: mejores placeholders | Task 4 | ✅ |
| Nueva llave: placeholders en etiqueta | Task 5 | ✅ |
| Nueva llave: valor oculto/mostrar | Task 5 | ✅ |
| Nueva llave: ayuda contextual | Task 5 | ✅ |
| Nueva llave: botón "Guardar credencial" | Tasks 1+5 | ✅ |
| Editar README: título "Documentación del proyecto" | Task 6 | ✅ |
| Editar README: ayuda Markdown | Task 6 | ✅ |
| Editar README: plantilla si vacío | Task 6 | ✅ |
| Editar README: mayor altura | Task 6 (h-80 vs h-64) | ✅ |
| Editar README: botón "Actualizar documentación" | Tasks 1+6 | ✅ |
| Editar proyecto: 2 columnas General (Nombre\|Dominio) | Task 3 | ✅ |
| Editar proyecto: 2 columnas Finanzas (Presupuesto\|Costos) | Task 3 | ✅ |
| Editar proyecto: placeholders Dominio/Presupuesto/Costos | Task 3 | ✅ |
| Editar proyecto: chips de tecnologías | Task 3 | ✅ |
| Editar proyecto: botón "Actualizar proyecto" | Tasks 1+3 | ✅ |
| Cobro recurrente: subtítulo | Task 7 | ✅ |
| Cobro recurrente: sugerencias concepto | Task 7 | ✅ |
| Cobro recurrente: formato monetario visual | Task 7 | ✅ |
| Cobro recurrente: resumen "Próximo cobro" | Task 7 | ✅ |
| Cobro recurrente: "Email del cliente (opcional)" | Task 7 | ✅ |
| Cobro recurrente: botón "Crear cobro recurrente" | Tasks 1+7 | ✅ |
| NO modificar Firestore | All tasks — no crm.* calls changed | ✅ |
| NO modificar esquemas | All tasks — no crm.ts changes | ✅ |
| NO agregar lógica nueva | All tasks — UI only | ✅ |

### Placeholder Scan
No TBDs, no "fill in later", no "similar to Task N" — all code blocks are complete.

### Type Consistency
- `formRefs.current["prio"]` used in Task 4 chip buttons — matches the `ref("prio")` hidden input in the same task. ✅
- `formRefs.current["concept"]`, `["frequency"]`, `["startDate"]` used in Task 7 — match the `ref("...")` calls in the same task. ✅
- `formRefs.current["label"]`, `["value"]` used in Task 5 — match the `ref("...")` calls in the same task. ✅
- `submitLabel` declared in Task 1, used by all subsequent tasks. ✅
- `handleModalSubmit` referenced in Task 4 `onKeyDown` — it's in scope (defined in `CRMShellProvider` above `renderModal()`). ✅
