"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useUser, useFirestore } from "@/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { CRMClient, CRMProject, CRMTask, CRMKey, Tool, KnowledgeTip } from "@/types/crm";

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

interface CRMContextValue {
  clients: CRMClient[];
  tools: Tool[];
  streak: number;
  loading: boolean;
  userEmail: string;
  addClient: (data: Omit<CRMClient, "id" | "projects" | "createdAt">) => void;
  updateClient: (id: string, data: Partial<CRMClient>) => void;
  deleteClient: (id: string) => void;
  addProject: (clientId: string, data: Omit<CRMProject, "id" | "keys" | "tasks" | "createdAt" | "guides" | "accounts" | "readme" | "prompt" | "quickNotes">) => void;
  updateProject: (clientId: string, projectId: string, data: Partial<CRMProject>) => void;
  deleteProject: (clientId: string, projectId: string) => void;
  addTask: (clientId: string, projectId: string, data: Pick<CRMTask, "name" | "desc" | "prio">) => void;
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
}

const CRMCtx = createContext<CRMContextValue | null>(null);

export function useCRM() {
  const ctx = useContext(CRMCtx);
  if (!ctx) throw new Error("useCRM must be used within CRMProvider");
  return ctx;
}

export function CRMProvider({ children }: { children: ReactNode }) {
  const user = useUser();
  const firestore = useFirestore();
  const [clients, setClients] = useState<CRMClient[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<{ clients: CRMClient[]; tools: Tool[]; streak: number }>({ clients: [], tools: [], streak: 0 });

  const userEmail = user?.email || "";
  const userUid = user?.uid;

  // Load data from Firestore
  useEffect(() => {
    if (!userUid || !firestore) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(firestore, "crm_data", userUid));
        if (!cancelled) {
          if (snap.exists()) {
            const d = snap.data();
            setClients(d.clients || []);
            setTools(d.tools || []);
            setStreak(d.streak || 0);
            dataRef.current = { clients: d.clients || [], tools: d.tools || [], streak: d.streak || 0 };
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userUid, firestore]);

  // Debounced save
  const persist = useCallback(() => {
    if (!userUid || !firestore) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(doc(firestore, "crm_data", userUid), {
        clients: dataRef.current.clients,
        tools: dataRef.current.tools,
        streak: dataRef.current.streak,
        lastActivity: new Date().toISOString(),
      });
    }, 500);
  }, [userUid, firestore]);

  const update = useCallback((newClients: CRMClient[], newStreak?: number) => {
    setClients(newClients);
    dataRef.current.clients = newClients;
    if (newStreak !== undefined) {
      setStreak(newStreak);
      dataRef.current.streak = newStreak;
    }
    persist();
  }, [persist]);

  const bumpStreak = useCallback(() => {
    const s = dataRef.current.streak + 1;
    setStreak(s);
    dataRef.current.streak = s;
  }, []);

  // CRUD: Clients
  const addClient = useCallback((data: Omit<CRMClient, "id" | "projects" | "createdAt">) => {
    const c: CRMClient = { ...data, id: uid(), projects: [], createdAt: new Date().toISOString() };
    const next = [...dataRef.current.clients, c];
    bumpStreak();
    update(next, dataRef.current.streak);
  }, [update, bumpStreak]);

  const updateClient = useCallback((id: string, data: Partial<CRMClient>) => {
    const next = dataRef.current.clients.map(c => c.id === id ? { ...c, ...data } : c);
    update(next);
  }, [update]);

  const deleteClient = useCallback((id: string) => {
    update(dataRef.current.clients.filter(c => c.id !== id));
  }, [update]);

  // CRUD: Projects
  const addProject = useCallback((clientId: string, data: Omit<CRMProject, "id" | "keys" | "tasks" | "createdAt" | "guides" | "accounts" | "readme" | "prompt" | "quickNotes">) => {
    const p: CRMProject = { ...data, id: uid(), keys: [], tasks: [], guides: "", accounts: "", readme: "", prompt: "", quickNotes: "", createdAt: new Date().toISOString() };
    const next = dataRef.current.clients.map(c =>
      c.id === clientId ? { ...c, projects: [...c.projects, p] } : c
    );
    bumpStreak();
    update(next, dataRef.current.streak);
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
  const addTask = useCallback((clientId: string, projectId: string, data: Pick<CRMTask, "name" | "desc" | "prio">) => {
    const t: CRMTask = { ...data, id: uid(), status: "pendiente", createdAt: new Date().toISOString(), pomoSessions: 0 };
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
    const order: CRMTask["status"][] = ["pendiente", "proceso", "completado", "detenido"];
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

  const incrementStreak = useCallback(() => {
    bumpStreak();
    update(dataRef.current.clients, dataRef.current.streak);
  }, [update, bumpStreak]);

  const updateTools = useCallback((newTools: Tool[]) => {
    setTools(newTools);
    dataRef.current.tools = newTools;
    persist();
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

  return (
    <CRMCtx.Provider value={{
      clients, tools, streak, loading, userEmail,
      addClient, updateClient, deleteClient,
      addProject, updateProject, deleteProject,
      addTask, updateTask, deleteTask, cycleTaskStatus,
      addKey, deleteKey,
      saveQuickNote, incrementStreak,
      addTool, updateTool, deleteTool,
      addTip, updateTip, deleteTip,
    }}>
      {children}
    </CRMCtx.Provider>
  );
}
