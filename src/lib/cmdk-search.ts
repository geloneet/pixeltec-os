import type { CRMClient } from "@/types/crm";

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

export interface CmdKResults {
  clients: CmdKClientResult[];
  projects: CmdKProjectResult[];
  tasks: CmdKTaskResult[];
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
}: {
  query: string;
  clients: CRMClient[];
}): CmdKResults {
  if (query.trim().length === 1) {
    return { clients: [], projects: [], tasks: [] };
  }

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


  return {
    clients: resultClients,
    projects: resultProjects,
    tasks: resultTasks,
  };
}
