'use server';
/**
 * @fileOverview Provides content enhancement suggestions for SEO, readability, and user engagement.
 *
 * - getContentEnhancementSuggestions - A function that takes content as input and returns enhancement suggestions.
 * - ContentEnhancementInput - The input type for the getContentEnhancementSuggestions function.
 * - ContentEnhancementOutput - The return type for the getContentEnhancementSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ContentEnhancementInputSchema = z.object({
  content: z.string().describe('The website content to be analyzed.'),
});
export type ContentEnhancementInput = z.infer<typeof ContentEnhancementInputSchema>;

const ContentEnhancementOutputSchema = z.object({
  seoSuggestions: z.array(z.string()).describe('Suggestions for improving SEO.'),
  readabilitySuggestions: z.array(z.string()).describe('Suggestions for improving readability.'),
  engagementSuggestions: z.array(z.string()).describe('Suggestions for improving user engagement.'),
});
export type ContentEnhancementOutput = z.infer<typeof ContentEnhancementOutputSchema>;

export async function getContentEnhancementSuggestions(input: ContentEnhancementInput): Promise<ContentEnhancementOutput> {
  return contentEnhancementFlow(input);
}

const contentEnhancementPrompt = ai.definePrompt({
  name: 'contentEnhancementPrompt',
  input: {schema: ContentEnhancementInputSchema},
  output: {schema: ContentEnhancementOutputSchema},
  prompt: `You are an AI expert in website content optimization.
  Analyze the following website content and provide suggestions for SEO, readability, and user engagement.

  Content: {{{content}}}

  Provide your suggestions in the following format:
  {
    "seoSuggestions": ["suggestion 1", "suggestion 2", ...],
    "readabilitySuggestions": ["suggestion 1", "suggestion 2", ...],
    "engagementSuggestions": ["suggestion 1", "suggestion 2", ...]
  }`,
});

const contentEnhancementFlow = ai.defineFlow(
  {
    name: 'contentEnhancementFlow',
    inputSchema: ContentEnhancementInputSchema,
    outputSchema: ContentEnhancementOutputSchema,
  },
  async input => {
    const {output} = await contentEnhancementPrompt(input);
    return output!;
  }
);
