'use server';
/**
 * @fileOverview An AI assistant that provides strategic advice based on client data.
 *
 * - getStrategicSuggestions - A function that takes client context and returns strategic suggestions.
 * - StrategicAdvisorInput - The input type for the getStrategicSuggestions function.
 * - StrategicAdvisorOutput - The return type for the getStrategicSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StrategicAdvisorInputSchema = z.object({
  clientName: z.string().describe("The name of the client's company."),
  tasks: z.string().describe('A list of pending tasks for the client.'),
  notes: z.string().describe('A log of recent notes and updates about the client.'),
  techStack: z.array(z.string()).describe('The technology stack used for the client.'),
});
export type StrategicAdvisorInput = z.infer<typeof StrategicAdvisorInputSchema>;

const StrategicAdvisorOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('A list of 3 short, direct, and actionable strategic suggestions.'),
});
export type StrategicAdvisorOutput = z.infer<typeof StrategicAdvisorOutputSchema>;

export async function getStrategicSuggestions(input: StrategicAdvisorInput): Promise<StrategicAdvisorOutput> {
  return strategicAdvisorFlow(input);
}

const strategicAdvisorPrompt = ai.definePrompt({
  name: 'strategicAdvisorPrompt',
  input: {schema: StrategicAdvisorInputSchema},
  output: {schema: StrategicAdvisorOutputSchema},
  prompt: `Eres el Director Técnico (CTO) de PixelTEC, una consultora de software de élite. Tu nombre es Miguel Robles.
  Tu objetivo es analizar la situación actual del cliente y proponer exactamente 3 acciones estratégicas, innovadoras y accionables.
  Las propuestas deben ser cortas, directas y en formato de lista.

  Analiza el siguiente contexto del cliente:

  **Cliente:** {{{clientName}}}
  **Stack Tecnológico:** {{{techStack}}}

  **Tareas Pendientes:**
  {{{tasks}}}

  **Bitácora Reciente:**
  {{{notes}}}

  Basado en este contexto, genera tus 3 propuestas estratégicas. Sé conciso y ve al grano.
  Por ejemplo, si el cliente tiene problemas con facturas, sugiere automatizar eso. Si su web es lenta, sugiere una optimización de rendimiento.`,
});

const strategicAdvisorFlow = ai.defineFlow(
  {
    name: 'strategicAdvisorFlow',
    inputSchema: StrategicAdvisorInputSchema,
    outputSchema: StrategicAdvisorOutputSchema,
  },
  async input => {
    const {output} = await strategicAdvisorPrompt(input);
    return output!;
  }
);
