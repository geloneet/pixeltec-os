import type { CRMClient } from "@/types/crm";
import type { VpsProject } from "@/lib/vps-types";

export interface CmdKClientResult {
  id: string;
  name: string;
  email: string;
}

export interface CmdKProjectResult {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
}

export interface CmdKTaskResult {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  clientName: string;
}

export interface CmdKVpsResult {
  id: string;
  name: string;
  domain: string | null;
  type: string;
}

export interface CmdKResults {
  clients: CmdKClientResult[];
  projects: CmdKProjectResult[];
  tasks: CmdKTaskResult[];
  vpsProjects: CmdKVpsResult[];
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matches(text: string, query: string): boolean {
  if (!query) return true;
  return normalize(text).includes(normalize(query));
}

const LIMIT_PER_GROUP = 8;

export function searchAcrossCRM({
  query,
  clients,
  vpsProjects,
}: {
  query: string;
  clients: CRMClient[];
  vpsProjects: VpsProject[];
}): CmdKResults {
  const shouldFilter = query.trim().length > 0;

  const resultClients: CmdKClientResult[] = clients
    .filter(
      (c) =>
        !shouldFilter ||
        matches(c.name, query) ||
        (c.email ? matches(c.email, query) : false),
    )
    .slice(0, LIMIT_PER_GROUP)
    .map((c) => ({ id: c.id, name: c.name, email: c.email }));

  const allProjects: CmdKProjectResult[] = [];
  const allTasks: CmdKTaskResult[] = [];

  clients.forEach((client) => {
    (client.projects || []).forEach((project) => {
      allProjects.push({
        id: project.id,
        name: project.name,
        clientId: client.id,
        clientName: client.name,
      });

      (project.tasks || []).forEach((task) => {
        allTasks.push({
          id: task.id,
          name: task.name,
          projectId: project.id,
          projectName: project.name,
          clientName: client.name,
        });
      });
    });
  });

  const resultProjects = allProjects
    .filter(
      (p) =>
        !shouldFilter || matches(p.name, query) || matches(p.clientName, query),
    )
    .slice(0, LIMIT_PER_GROUP);

  const resultTasks = allTasks
    .filter(
      (t) =>
        !shouldFilter ||
        matches(t.name, query) ||
        matches(t.projectName, query) ||
        matches(t.clientName, query),
    )
    .slice(0, LIMIT_PER_GROUP);

  const resultVps: CmdKVpsResult[] = vpsProjects
    .filter(
      (v) =>
        !shouldFilter ||
        matches(v.name, query) ||
        (v.domain ? matches(v.domain, query) : false),
    )
    .slice(0, LIMIT_PER_GROUP)
    .map((v) => ({ id: v.id, name: v.name, domain: v.domain, type: v.type }));

  return {
    clients: resultClients,
    projects: resultProjects,
    tasks: resultTasks,
    vpsProjects: resultVps,
  };
}
