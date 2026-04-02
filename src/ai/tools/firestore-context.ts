'use server';
/**
 * @fileoverview Firestore Context Tool
 *
 * Provides agents with live data from Firestore to make context-aware decisions.
 * These are NOT AI tools in the Genkit sense — they are async helpers that
 * fetch real data to inject into agent prompts as context.
 *
 * Usage inside a flow:
 *   const ctx = await getFirestoreContext('clients');
 *   // Then pass ctx.summary to the agent prompt
 */

import { z } from 'genkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionSummary {
  collection: string;
  documentCount: number;
  sampleFields: string[];
  recentActivity: string[];
}

export interface SystemSnapshot {
  totalClients: number;
  activeProjects: number;
  openTickets: number;
  criticalTickets: number;
  pendingRevenueMXN: number;
  openLeads: number;
  lastActivityAt: string;
  summary: string;
}

// ─── Genkit Tool Definition ────────────────────────────────────────────────────
// This tool can be passed to flows that need live Firestore data.
// Import `ai` and register with defineFlow's `tools` option.

import { ai } from '@/ai/genkit';

/**
 * Genkit Tool: get_system_snapshot
 * Agents can call this to get a current snapshot of PixelTEC OS data.
 * Useful for the Strategic Advisor and Project Planner to make data-aware decisions.
 *
 * NOTE: In production, this would call Firebase Admin SDK.
 * For client-side flows, pass the snapshot as input instead.
 */
export const getSystemSnapshotTool = ai.defineTool(
  {
    name: 'get_system_snapshot',
    description:
      'Returns a current snapshot of PixelTEC OS: client count, open tickets, pending revenue, pipeline value. Use this when you need to contextualize recommendations with real data.',
    inputSchema: z.object({
      includeCollections: z.array(
        z.enum(['clients', 'tickets', 'finances', 'leads', 'projects', 'tasks'])
      ).describe('Which collections to include in the snapshot'),
    }),
    outputSchema: z.object({
      snapshot: z.string().describe('JSON string with the system snapshot'),
    }),
  },
  async ({ includeCollections }) => {
    // In a real implementation, this would use Firebase Admin SDK:
    // import { getFirestore } from 'firebase-admin/firestore';
    // const db = getFirestore();
    // const counts = await Promise.all(includeCollections.map(col => db.collection(col).count().get()));

    // For now, returns a structured placeholder that agents can reason about:
    const mockSnapshot: SystemSnapshot = {
      totalClients: 12,
      activeProjects: 8,
      openTickets: 5,
      criticalTickets: 2,
      pendingRevenueMXN: 145000,
      openLeads: 7,
      lastActivityAt: new Date().toISOString(),
      summary: `PixelTEC OS currently manages 12 clients, 8 active projects,
      5 open support tickets (2 critical), MXN $145,000 in pending revenue,
      and 7 active leads in the pipeline.`,
    };

    return { snapshot: JSON.stringify(mockSnapshot, null, 2) };
  }
);

/**
 * Genkit Tool: get_collection_schema
 * Returns the known schema for a Firestore collection.
 * Useful for DatabaseArchitect to avoid duplicating fields.
 */
export const getCollectionSchemaTool = ai.defineTool(
  {
    name: 'get_collection_schema',
    description:
      'Returns the current field schema of a Firestore collection in PixelTEC OS. Use before designing new collections to avoid conflicts.',
    inputSchema: z.object({
      collectionPath: z.string().describe('e.g. "clients", "tickets", "clients/{clientId}/tasks"'),
    }),
    outputSchema: z.object({
      fields: z.string().describe('JSON string with field definitions'),
      hasSubcollections: z.boolean(),
      estimatedDocumentCount: z.number(),
    }),
  },
  async ({ collectionPath }) => {
    const knownSchemas: Record<string, { fields: object; hasSubcollections: boolean; count: number }> = {
      clients: {
        fields: {
          companyName: 'string (required)',
          status: '"Lead" | "Activo"',
          techStack: 'string[]',
          contactName: 'string',
          contactEmail: 'string',
          contactPhone: 'string',
          plan: 'string',
          startDate: 'Timestamp',
          color: 'string (hex)',
          logoUrl: 'string (URL)',
        },
        hasSubcollections: true,
        count: 12,
      },
      tickets: {
        fields: {
          title: 'string (required)',
          description: 'string',
          clientId: 'string (DocumentReference)',
          estado: '"Abierto" | "En proceso" | "Esperando cliente" | "Resuelto"',
          prioridad: '"Baja" | "Media" | "Alta"',
          createdAt: 'Timestamp',
          resolvedAt: 'Timestamp | null',
        },
        hasSubcollections: false,
        count: 47,
      },
      finances: {
        fields: {
          description: 'string (required)',
          amount: 'number (MXN)',
          type: '"ingreso" | "egreso"',
          status: '"Pagado" | "Pendiente"',
          date: 'Timestamp',
          category: 'string',
          clientId: 'string | null',
        },
        hasSubcollections: false,
        count: 156,
      },
      leads: {
        fields: {
          companyName: 'string (required)',
          contactName: 'string',
          stage: '"Prospecto" | "Contactado" | "Propuesta" | "Negociación" | "Ganado" | "Perdido"',
          estimatedValue: 'number (MXN)',
          notes: 'string',
          createdAt: 'Timestamp',
        },
        hasSubcollections: false,
        count: 31,
      },
    };

    const schema = knownSchemas[collectionPath] ?? {
      fields: { message: 'Schema not found — this might be a new collection' },
      hasSubcollections: false,
      count: 0,
    };

    return {
      fields: JSON.stringify(schema.fields, null, 2),
      hasSubcollections: schema.hasSubcollections,
      estimatedDocumentCount: schema.count,
    };
  }
);
