"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import { clientSchema, projectSchema, taskSchema } from "@/lib/crm-schemas";
import { getCrmDataAction, syncCrmDataAction, type CrmSyncPayload } from "./crm-actions";
import type { CRMClient, CRMProject, CRMTask, CRMKey, Tool, KnowledgeTip, ServerClientLink, RecurringCharge, ProjectLogEntry } from "@/types/crm";
import type { WorkSession, BlockerType, BlockerStatus, BlockerImpact, BlockerSource, ObservationType, SessionGoal } from "@/types/session";

const MAX_LOG_ENTRIES = 500;

// Secciones top-level que `persist()` puede sincronizar de forma
// independiente — ver el comentario de `persist` más abajo.
type PersistedKey = keyof CrmSyncPayload;

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// `RecurringCharge.amount` is a free-text string. Strip currency symbols,
// thousands separators and whitespace (e.g. "$1,500.00" -> "1500.00") and
// validate the result is a finite, positive number before ever letting it
// reach the server — otherwise downstream `Number(charge.amount)` sums
// silently turn into NaN -> 0, under-reporting revenue totals and emails.
// Returns the cleaned numeric value, or `null` if the input isn't a valid
// positive amount.
function normalizeChargeAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

interface CRMContextValue {
  clients: CRMClient[];
  tools: Tool[];
  streak: number;
  loading: boolean;
  userEmail: string;
  addClient: (data: Omit<CRMClient, "id" | "projects" | "createdAt">) => string | null;
  updateClient: (id: string, data: Partial<CRMClient>) => void;
  deleteClient: (id: string) => void;
  addProject: (clientId: string, data: Omit<CRMProject, "id" | "keys" | "tasks" | "charges" | "createdAt" | "guides" | "accounts" | "readme" | "prompt" | "quickNotes">) => string | null;
  /** Guarda YA lo pendiente del debounce y espera a que termine (propaga error). */
  flushSave: () => Promise<void>;
  updateProject: (clientId: string, projectId: string, data: Partial<CRMProject>) => void;
  deleteProject: (clientId: string, projectId: string) => void;
  addTask: (clientId: string, projectId: string, data: Pick<CRMTask, "name" | "desc" | "prio"> & Partial<Pick<CRMTask, "sessionId">>) => void;
  updateTask: (clientId: string, projectId: string, taskId: string, data: Partial<CRMTask>) => void;
  deleteTask: (clientId: string, projectId: string, taskId: string) => void;
  cycleTaskStatus: (clientId: string, projectId: string, taskId: string) => void;
  addKey: (clientId: string, projectId: string, key: Omit<CRMKey, "id">) => void;
  deleteKey: (clientId: string, projectId: string, keyId: string) => void;
  saveQuickNote: (clientId: string, projectId: string, note: string) => void;
  incrementStreak: () => void;
  addTool: (data: Pick<Tool, "name" | "icon" | "color">) => void;
  updateTool: (toolId: string, data: Partial<Tool>) => void;
  deleteTool: (toolId: string) => void;
  addTip: (toolId: string, data: Pick<KnowledgeTip, "title" | "summary" | "content" | "tags">) => void;
  updateTip: (toolId: string, tipId: string, data: Partial<KnowledgeTip>) => void;
  deleteTip: (toolId: string, tipId: string) => void;
  serverLinks: ServerClientLink;
  linkProjectToClient: (projectId: string, clientId: string) => void;
  unlinkProject: (projectId: string) => void;
  addCharge: (clientId: string, projectId: string, data: Partial<RecurringCharge>) => void;
  updateCharge: (clientId: string, projectId: string, chargeId: string, data: Partial<RecurringCharge>) => void;
  deleteCharge: (clientId: string, projectId: string, chargeId: string) => void;
  addProjectLogEntry: (clientId: string, projectId: string, entry: Omit<ProjectLogEntry, "id">) => void;
  sessions: WorkSession[];
  startSession: (clientId: string, projectId: string, taskId: string, clientName: string, projectName: string, taskName: string) => WorkSession;
  startActivity: (sessionId: string, description: string, estimatedMinutes?: number) => void;
  updateCurrentActivity: (sessionId: string, description: string) => void;
  completeActivity: (sessionId: string) => void;
  addSessionGoal: (sessionId: string, text: string) => void;
  toggleSessionGoal: (sessionId: string, goalId: string) => void;
  removeSessionGoal: (sessionId: string, goalId: string) => void;
  updateSessionGoal: (sessionId: string, goalId: string, text: string) => void;
  reorderSessionGoal: (sessionId: string, goalId: string, direction: "up" | "down") => void;
  addSessionNote: (sessionId: string, type: ObservationType, content: string) => void;
  markNoteForSummary: (sessionId: string, noteId: string) => void;
  addSessionBlocker: (sessionId: string, type: BlockerType, description: string, impact: BlockerImpact, source: BlockerSource) => void;
  updateBlockerStatus: (sessionId: string, blockerId: string, status: BlockerStatus) => void;
  endSession: (sessionId: string, deployStatus: "yes" | "no" | "na", commitStatus: boolean) => void;
  getProjectSessions: (projectId: string) => WorkSession[];
}

const CRMCtx = createContext<CRMContextValue | null>(null);

export function useCRM() {
  const ctx = useContext(CRMCtx);
  if (!ctx) throw new Error("useCRM must be used within CRMProvider");
  return ctx;
}

export function CRMProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [streak, setStreak] = useState(0);
  const [serverLinks, setServerLinks] = useState<ServerClientLink>({});
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<{ clients: CRMClient[]; tools: Tool[]; streak: number; serverLinks: ServerClientLink; sessions: WorkSession[] }>({ clients: [], tools: [], streak: 0, serverLinks: {}, sessions: [] });

  const userEmail = user?.email || "";

  // Carga inicial desde Postgres (Fase 4 — antes: onSnapshot/getDoc de
  // Firestore). La sesión se resuelve del lado del servidor dentro de
  // `getCrmDataAction` (cookie de NextAuth) — solo esperamos a que
  // `useUser()` deje de estar en `undefined` (sesión cargando) antes de
  // pedir los datos.
  useEffect(() => {
    if (user === undefined) return;
    if (user === null) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const d = await getCrmDataAction();
        if (!cancelled) {
          // `getFullCrmData` (repos/crm-sync.ts) ya devuelve datos normalizados
          // (budget/annual como number, status válido, notesLog poblado) — no
          // hace falta la migración legacy que sí necesitaba el blob crudo de
          // Firestore.
          setClients(d.clients);
          setTools(d.tools);
          setStreak(d.streak);
          setServerLinks(d.serverLinks);
          setSessions(d.sessions);
          dataRef.current = d;
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading CRM data:', error);
        if (!cancelled) {
          setLoading(false);
          toast.error('Error al cargar datos del CRM', {
            description: error instanceof Error ? error.message : 'Intenta recargar la página',
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Debounced save.
  //
  // `crm_data/{uid}` is also written by the charges cron
  // (src/app/api/notifications/charges/route.ts, via its own Admin SDK
  // transaction that only touches the `clients` field) and can be open in
  // multiple browser tabs at once. A blind `setDoc` of the whole document
  // built from this tab's in-memory `dataRef` would silently revert
  // whatever any other writer touched since this tab last loaded.
  //
  // Fix: wrap the write in a client `runTransaction` that rereads the doc
  // right before writing, and only overwrites the TOP-LEVEL section(s) this
  // call actually changed (`changedKeys`) — every other section is taken
  // from the just-read remote doc instead of this tab's possibly-stale
  // copy. Firestore retries the transaction automatically if the doc
  // changes concurrently.
  //
  // LIMITATION: this is a shallow, section-level merge (clients / tools /
  // streak / serverLinks / sessions), not a deep field-level merge. It
  // fully protects cross-section races (e.g. cron editing
  // `clients[].projects[].charges[].lastNotified` while this tab edits
  // `tools`). It does NOT protect two tabs editing the SAME section at the
  // same time (e.g. both editing `clients`) — within a section it's still
  // last-write-wins. A true merge there would need to diff into
  // clients→projects→tasks/charges, which is too deep/costly to do safely
  // as part of this fix.
  // Las claves pendientes se ACUMULAN entre llamadas (union), no se
  // reemplazan: dos persist() distintos dentro de la misma ventana de
  // debounce (ej. "clients" y luego "tools") guardan ambas secciones en un
  // solo save — antes el segundo clearTimeout descartaba las claves del
  // primero y esa sección quedaba sin guardar hasta el siguiente cambio.
  const pendingKeys = useRef<Set<PersistedKey>>(new Set());

  const doSave = useCallback(async () => {
    const changedKeys = Array.from(pendingKeys.current);
    pendingKeys.current.clear();
    if (changedKeys.length === 0) return;
    const payload: CrmSyncPayload = {};
    if (changedKeys.includes("clients")) payload.clients = dataRef.current.clients;
    if (changedKeys.includes("tools")) payload.tools = dataRef.current.tools;
    if (changedKeys.includes("streak")) payload.streak = dataRef.current.streak;
    if (changedKeys.includes("serverLinks")) payload.serverLinks = dataRef.current.serverLinks;
    if (changedKeys.includes("sessions")) payload.sessions = dataRef.current.sessions;
    const result = await syncCrmDataAction(payload);
    if (!result.ok) throw new Error(result.error);
  }, []);

  const persist = useCallback((changedKeys: PersistedKey[]) => {
    changedKeys.forEach((k) => pendingKeys.current.add(k));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await doSave();
      } catch (error) {
        console.error('Error saving CRM data:', error);
        toast.error('Error al guardar cambios', {
          description: 'Los cambios no se guardaron. Intenta recargar la página.',
        });
      }
    }, 500);
  }, [doSave]);

  // Guardado inmediato, sin debounce, que PROPAGA el error al caller.
  // Para flujos que necesitan que el estado del CRM ya esté en Postgres
  // antes de su siguiente server action (ej. firmar contrato → vincular
  // proyecto): las server actions de Next se ejecutan EN SERIE por cliente,
  // así que un action que "espere" al sync debounced se bloquea a sí mismo —
  // el sync queda formado en la cola detrás de él y nunca llega. La única
  // forma correcta es completar el sync ANTES de disparar el siguiente action.
  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await doSave();
  }, [doSave]);

  const update = useCallback((newClients: CRMClient[], newStreak?: number) => {
    setClients(newClients);
    dataRef.current.clients = newClients;
    const changedKeys: PersistedKey[] = ["clients"];
    if (newStreak !== undefined) {
      setStreak(newStreak);
      dataRef.current.streak = newStreak;
      changedKeys.push("streak");
    }
    persist(changedKeys);
  }, [persist]);

  const bumpStreak = useCallback(() => {
    const s = dataRef.current.streak + 1;
    setStreak(s);
    dataRef.current.streak = s;
  }, []);

  // CRUD: Clients
  const addClient = useCallback((data: Omit<CRMClient, "id" | "projects" | "createdAt">): string | null => {
    const validation = clientSchema.safeParse(data);
    if (!validation.success) {
      toast.error('Datos inválidos', {
        description: validation.error.errors[0]?.message || 'Revisa los campos',
      });
      return null;
    }
    const c: CRMClient = { ...data, id: uid(), projects: [], createdAt: new Date().toISOString() };
    const next = [...dataRef.current.clients, c];
    bumpStreak();
    update(next, dataRef.current.streak);
    return c.id;
  }, [update, bumpStreak]);

  const updateClient = useCallback((id: string, data: Partial<CRMClient>) => {
    const next = dataRef.current.clients.map(c => c.id === id ? { ...c, ...data } : c);
    update(next);
  }, [update]);

  const deleteClient = useCallback((id: string) => {
    update(dataRef.current.clients.filter(c => c.id !== id));
  }, [update]);

  // CRUD: Projects
  const addProject = useCallback((clientId: string, data: Omit<CRMProject, "id" | "keys" | "tasks" | "charges" | "createdAt" | "guides" | "accounts" | "readme" | "prompt" | "quickNotes">): string | null => {
    const validation = projectSchema.safeParse(data);
    if (!validation.success) {
      toast.error('Datos inválidos', {
        description: validation.error.errors[0]?.message || 'Revisa los campos',
      });
      return null;
    }
    const p: CRMProject = { ...data, id: uid(), keys: [], tasks: [], charges: [], guides: "", accounts: "", readme: "", prompt: "", quickNotes: "", notesLog: [], createdAt: new Date().toISOString() };
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: [...c.projects, p] } : c
    );
    bumpStreak();
    update(next, dataRef.current.streak);
    return p.id;
  }, [update, bumpStreak]);

  const updateProject = useCallback((clientId: string, projectId: string, data: Partial<CRMProject>) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, ...data } : p) } : c
    );
    update(next);
  }, [update]);

  const deleteProject = useCallback((clientId: string, projectId: string) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.filter(p => p.id !== projectId) } : c
    );
    update(next);
  }, [update]);

  // CRUD: Tasks
  const addTask = useCallback((clientId: string, projectId: string, data: Pick<CRMTask, "name" | "desc" | "prio"> & Partial<Pick<CRMTask, "sessionId">>) => {
    const { sessionId, ...taskFields } = data;
    const validation = taskSchema.safeParse(taskFields);
    if (!validation.success) {
      toast.error('Datos inválidos', {
        description: validation.error.errors[0]?.message || 'Revisa los campos',
      });
      return;
    }
    const t: CRMTask = { ...taskFields, id: uid(), status: "pendiente", createdAt: new Date().toISOString(), pomoSessions: 0, sessionId };
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, t] } : p) } : c
    );
    bumpStreak();
    update(next, dataRef.current.streak);
  }, [update, bumpStreak]);

  const updateTask = useCallback((clientId: string, projectId: string, taskId: string, data: Partial<CRMTask>) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...data } : t) } : p) } : c
    );
    update(next);
  }, [update]);

  const deleteTask = useCallback((clientId: string, projectId: string, taskId: string) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p) } : c
    );
    update(next);
  }, [update]);

  const cycleTaskStatus = useCallback((clientId: string, projectId: string, taskId: string) => {
    const order: CRMTask["status"][] = ["pendiente", "en_progreso", "en_revision", "completado", "pausado"];
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? {
        ...c, projects: c.projects.map(p => p.id === projectId ? {
          ...p, tasks: p.tasks.map(t => {
            if (t.id !== taskId) return t;
            const idx = order.indexOf(t.status);
            const newStatus = order[(idx + 1) % order.length];
            if (newStatus === "completado") bumpStreak();
            return { ...t, status: newStatus };
          })
        } : p)
      } : c
    );
    update(next, dataRef.current.streak);
  }, [update, bumpStreak]);

  // Keys
  const addKey = useCallback((clientId: string, projectId: string, key: Omit<CRMKey, "id">) => {
    const k: CRMKey = { ...key, id: uid() };
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, keys: [...p.keys, k] } : p) } : c
    );
    bumpStreak();
    update(next, dataRef.current.streak);
  }, [update, bumpStreak]);

  const deleteKey = useCallback((clientId: string, projectId: string, keyId: string) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, keys: p.keys.filter(k => k.id !== keyId) } : p) } : c
    );
    update(next);
  }, [update]);

  // Quick notes
  const saveQuickNote = useCallback((clientId: string, projectId: string, note: string) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, quickNotes: note } : p) } : c
    );
    update(next);
  }, [update]);

  const addProjectLogEntry = useCallback(
    (clientId: string, projectId: string, entry: Omit<ProjectLogEntry, "id">) => {
      const newEntry: ProjectLogEntry = { ...entry, id: uid() };
      const next = dataRef.current.clients.map(c =>
        c.id !== clientId ? c : {
          ...c,
          projects: c.projects.map(p =>
            p.id !== projectId ? p : {
              ...p,
              notesLog: [
                newEntry,
                ...(p.notesLog ?? []),
              ].slice(0, MAX_LOG_ENTRIES),
            }
          ),
        }
      );
      update(next);
    },
    [update]
  );

  const incrementStreak = useCallback(() => {
    bumpStreak();
    update(dataRef.current.clients, dataRef.current.streak);
  }, [update, bumpStreak]);

  const updateTools = useCallback((newTools: Tool[]) => {
    setTools(newTools);
    dataRef.current.tools = newTools;
    persist(["tools"]);
  }, [persist]);

  // CRUD: Tools
  const addTool = useCallback((data: Pick<Tool, "name" | "icon" | "color">) => {
    const t: Tool = { ...data, id: uid(), tips: [], createdAt: new Date().toISOString() };
    updateTools([...dataRef.current.tools, t]);
  }, [updateTools]);

  const updateTool = useCallback((toolId: string, data: Partial<Tool>) => {
    updateTools(dataRef.current.tools.map(t => t.id === toolId ? { ...t, ...data } : t));
  }, [updateTools]);

  const deleteTool = useCallback((toolId: string) => {
    updateTools(dataRef.current.tools.filter(t => t.id !== toolId));
  }, [updateTools]);

  // CRUD: Tips
  const addTip = useCallback((toolId: string, data: Pick<KnowledgeTip, "title" | "summary" | "content" | "tags">) => {
    const now = new Date().toISOString();
    const tip: KnowledgeTip = { ...data, id: uid(), createdAt: now, updatedAt: now };
    updateTools(dataRef.current.tools.map(t =>
      t.id === toolId ? { ...t, tips: [...t.tips, tip] } : t
    ));
  }, [updateTools]);

  const updateTip = useCallback((toolId: string, tipId: string, data: Partial<KnowledgeTip>) => {
    updateTools(dataRef.current.tools.map(t =>
      t.id === toolId ? { ...t, tips: t.tips.map(tip => tip.id === tipId ? { ...tip, ...data, updatedAt: new Date().toISOString() } : tip) } : t
    ));
  }, [updateTools]);

  const deleteTip = useCallback((toolId: string, tipId: string) => {
    updateTools(dataRef.current.tools.map(t =>
      t.id === toolId ? { ...t, tips: t.tips.filter(tip => tip.id !== tipId) } : t
    ));
  }, [updateTools]);

  // CRUD: Charges
  const addCharge = useCallback((clientId: string, projectId: string, data: Partial<RecurringCharge>) => {
    const normalizedAmount = normalizeChargeAmount(String(data.amount ?? ""));
    if (normalizedAmount === null) {
      toast.error('Monto inválido', {
        description: 'Ingresa un monto numérico positivo (ej. 1500 o 1,500.00).',
      });
      return;
    }
    const ch: RecurringCharge = {
      id: uid(),
      concept: data.concept || "",
      amount: String(normalizedAmount),
      frequency: data.frequency || "monthly",
      startDate: data.startDate || new Date().toISOString(),
      clientEmail: data.clientEmail || "",
      active: true,
      createdAt: new Date().toISOString(),
    };
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, charges: [...(p.charges || []), ch] } : p) } : c
    );
    update(next);
  }, [update]);

  const updateCharge = useCallback((clientId: string, projectId: string, chargeId: string, data: Partial<RecurringCharge>) => {
    let patch = data;
    if (data.amount !== undefined) {
      const normalizedAmount = normalizeChargeAmount(String(data.amount));
      if (normalizedAmount === null) {
        toast.error('Monto inválido', {
          description: 'Ingresa un monto numérico positivo (ej. 1500 o 1,500.00).',
        });
        return;
      }
      patch = { ...data, amount: String(normalizedAmount) };
    }
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, charges: (p.charges || []).map(ch => ch.id === chargeId ? { ...ch, ...patch } : ch) } : p) } : c
    );
    update(next);
  }, [update]);

  const deleteCharge = useCallback((clientId: string, projectId: string, chargeId: string) => {
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: c.projects.map(p => p.id === projectId ? { ...p, charges: (p.charges || []).filter(ch => ch.id !== chargeId) } : p) } : c
    );
    update(next);
  }, [update]);

  // Sessions
  const updateSessions = useCallback((newSessions: WorkSession[]) => {
    setSessions(newSessions);
    dataRef.current.sessions = newSessions;
    persist(["sessions"]);
  }, [persist]);

  const startSession = useCallback((
    clientId: string, projectId: string, taskId: string,
    clientName: string, projectName: string, taskName: string
  ): WorkSession => {
    // Return existing active session for same project+task if one exists
    const existing = dataRef.current.sessions.find(
      s => s.projectId === projectId && s.taskId === taskId && s.status === "active"
    );
    if (existing) return existing;

    const session: WorkSession = {
      id: uid(),
      clientId, projectId, taskId,
      clientName, projectName, taskName,
      startedAt: new Date().toISOString(),
      status: "active",
      activities: [],
      notes: [],
      blockers: [],
      sessionGoals: [],
      createdBy: userEmail,
    };
    updateSessions([...dataRef.current.sessions, session]);
    return session;
  }, [updateSessions, userEmail]);

  const startActivity = useCallback((sessionId: string, description: string, estimatedMinutes?: number) => {
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      const hasOpen = s.activities.some(a => !a.completedAt);
      if (hasOpen) return s;
      const activity = {
        id: uid(),
        description,
        startedAt: new Date().toISOString(),
        ...(estimatedMinutes != null ? { estimatedMinutes } : {}),
      };
      return { ...s, currentActivity: description, activities: [...s.activities, activity] };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const updateCurrentActivity = useCallback((sessionId: string, description: string) => {
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        currentActivity: description,
        activities: s.activities.map(a =>
          !a.completedAt ? { ...a, description } : a
        ),
      };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const completeActivity = useCallback((sessionId: string) => {
    const now = new Date().toISOString();
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        currentActivity: undefined,
        activities: s.activities.map(a =>
          !a.completedAt ? { ...a, completedAt: now } : a
        ),
      };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const addSessionGoal = useCallback((sessionId: string, text: string) => {
    const goal: SessionGoal = {
      id: uid(), text, completed: false, createdAt: new Date().toISOString(),
    };
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId ? { ...s, sessionGoals: [...(s.sessionGoals ?? []), goal] } : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const toggleSessionGoal = useCallback((sessionId: string, goalId: string) => {
    const now = new Date().toISOString();
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        sessionGoals: (s.sessionGoals ?? []).map(g =>
          g.id === goalId
            ? { ...g, completed: !g.completed, completedAt: !g.completed ? now : undefined }
            : g
        ),
      };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const removeSessionGoal = useCallback((sessionId: string, goalId: string) => {
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId
        ? { ...s, sessionGoals: (s.sessionGoals ?? []).filter(g => g.id !== goalId) }
        : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const updateSessionGoal = useCallback((sessionId: string, goalId: string, text: string) => {
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId
        ? { ...s, sessionGoals: (s.sessionGoals ?? []).map(g => g.id === goalId ? { ...g, text } : g) }
        : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const reorderSessionGoal = useCallback((sessionId: string, goalId: string, direction: "up" | "down") => {
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      const goals = [...(s.sessionGoals ?? [])];
      const idx = goals.findIndex(g => g.id === goalId);
      if (idx === -1) return s;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= goals.length) return s;
      [goals[idx], goals[targetIdx]] = [goals[targetIdx], goals[idx]];
      return { ...s, sessionGoals: goals };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const addSessionNote = useCallback((sessionId: string, type: ObservationType, content: string) => {
    const note = {
      id: uid(), type, content, createdAt: new Date().toISOString(),
    };
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId ? { ...s, notes: [...s.notes, note] } : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const markNoteForSummary = useCallback((sessionId: string, noteId: string) => {
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        notes: s.notes.map(n => n.id === noteId ? { ...n, markedForSummary: true } : n),
      };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const addSessionBlocker = useCallback((
    sessionId: string,
    type: BlockerType,
    description: string,
    impact: BlockerImpact,
    source: BlockerSource,
  ) => {
    const blocker = {
      id: uid(), type, description, status: "active" as const, impact, source,
      createdAt: new Date().toISOString(),
    };
    const updated = dataRef.current.sessions.map(s =>
      s.id === sessionId ? { ...s, blockers: [...s.blockers, blocker] } : s
    );
    updateSessions(updated);
  }, [updateSessions]);

  const updateBlockerStatus = useCallback((sessionId: string, blockerId: string, status: BlockerStatus) => {
    const now = new Date().toISOString();
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      return {
        ...s,
        blockers: s.blockers.map(b =>
          b.id === blockerId
            ? { ...b, status, ...(status === "resolved" ? { resolvedAt: now } : {}) }
            : b
        ),
      };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const endSession = useCallback((sessionId: string, deployStatus: "yes" | "no" | "na", commitStatus: boolean) => {
    const now = new Date().toISOString();
    const updated = dataRef.current.sessions.map(s => {
      if (s.id !== sessionId) return s;
      const durationSeconds = Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000);
      // Mark any open activity as completed
      const activities = s.activities.map(a =>
        !a.completedAt ? { ...a, completedAt: now } : a
      );
      return { ...s, status: "completed" as const, endedAt: now, durationSeconds, deployStatus, commitStatus, currentActivity: undefined, activities };
    });
    updateSessions(updated);
  }, [updateSessions]);

  const getProjectSessions = useCallback((projectId: string): WorkSession[] => {
    return dataRef.current.sessions.filter(s => s.projectId === projectId);
  }, []);

  const linkProjectToClient = useCallback((projectId: string, clientId: string) => {
    const next = { ...dataRef.current.serverLinks, [projectId]: clientId };
    setServerLinks(next);
    dataRef.current.serverLinks = next;
    persist(["serverLinks"]);
  }, [persist]);

  const unlinkProject = useCallback((projectId: string) => {
    const next = { ...dataRef.current.serverLinks };
    delete next[projectId];
    setServerLinks(next);
    dataRef.current.serverLinks = next;
    persist(["serverLinks"]);
  }, [persist]);

  return (
    <CRMCtx.Provider value={{
      clients, tools, streak, loading, userEmail,
      addClient, updateClient, deleteClient,
      addProject, updateProject, deleteProject, flushSave,
      addTask, updateTask, deleteTask, cycleTaskStatus,
      addKey, deleteKey,
      saveQuickNote, incrementStreak,
      addTool, updateTool, deleteTool,
      addTip, updateTip, deleteTip,
      serverLinks, linkProjectToClient, unlinkProject,
      addCharge, updateCharge, deleteCharge,
      addProjectLogEntry,
      sessions,
      startSession, startActivity, updateCurrentActivity, completeActivity,
      addSessionGoal, toggleSessionGoal, removeSessionGoal, updateSessionGoal, reorderSessionGoal,
      addSessionNote, markNoteForSummary,
      addSessionBlocker, updateBlockerStatus,
      endSession, getProjectSessions,
    }}>
      {children}
    </CRMCtx.Provider>
  );
}
