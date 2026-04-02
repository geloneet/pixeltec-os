'use server';
/**
 * @fileOverview An AI assistant that provides strategic advice based on global client data.
 *
 * - getGlobalStrategicInsights - A function that takes a summary of notes from all clients and returns strategic insights.
 * - GlobalStrategicInsightsInput - The input type for the getGlobalStrategicInsights function.
 * - GlobalStrategicInsightsOutput - The return type for the getGlobalStrategicInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GlobalStrategicInsightsInputSchema = z.object({
  allNotes: z.string().describe('A compilation of the latest notes from all clients, each prefixed with the client name.'),
});
export type GlobalStrategicInsightsInput = z.infer<typeof GlobalStrategicInsightsInputSchema>;

const InsightSchema = z.object({
    clientName: z.string().describe("The name of the client this insight pertains to."),
    type: z.enum(['alert', 'suggestion']).describe("The type of insight: 'alert' for urgent meetings, 'suggestion' for automation opportunities."),
    text: z.string().describe("The detailed insight or recommendation."),
});

const GlobalStrategicInsightsOutputSchema = z.object({
  insights: z.array(InsightSchema).describe('A list of strategic insights, alerts, or suggestions.'),
});
export type GlobalStrategicInsightsOutput = z.infer<typeof GlobalStrategicInsightsOutputSchema>;

export async function getGlobalStrategicInsights(input: GlobalStrategicInsightsInput): Promise<GlobalStrategicInsightsOutput> {
  return globalStrategicAdvisorFlow(input);
}

const globalStrategicAdvisorPrompt = ai.definePrompt({
  name: 'globalStrategicAdvisorPrompt',
  input: {schema: GlobalStrategicInsightsInputSchema},
  output: {schema: GlobalStrategicInsightsOutputSchema},
  prompt: `Eres un Consultor Senior de Estrategia en PixelTEC. Tu nombre es Miguel Robles.
  Tu misión es analizar estas notas consolidadas de TODOS los clientes y detectar proactivamente urgencias, cuellos de botella o patrones recurrentes.

  - Si un cliente (ej. "Pipas Tondoroque", "Velank Boutique", "Smile More") menciona problemas recurrentes, genera una 'Alerta de Reunión Urgente' con el cliente para abordar el problema de raíz.
  - Si detectas un proceso manual o ineficiente, genera una 'Sugerencia de Automatización' con una tecnología específica (ej. n8n, Python, etc.).
  - Basa tus insights EXCLUSIVAMENTE en las notas proporcionadas.
  - Sé específico y accionable. No generes más de 3-4 insights clave en total.

  Notas de Clientes:
  {{{allNotes}}}
  `,
});

const globalStrategicAdvisorFlow = ai.defineFlow(
  {
    name: 'globalStrategicAdvisorFlow',
    inputSchema: GlobalStrategicInsightsInputSchema,
    outputSchema: GlobalStrategicInsightsOutputSchema,
  },
  async input => {
    const {output} = await globalStrategicAdvisorPrompt(input);
    return output!;
  }
);
