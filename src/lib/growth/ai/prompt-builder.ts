import type { BrandBrain } from '@/types/growth/brand-brain';

export interface PostGenerationRequest {
  objective: string;
  format: 'instagram_post' | 'instagram_story' | 'facebook_post' | 'linkedin_post' | 'twitter_post';
  topic?: string;
  tone?: string;
  withImage: boolean;
}

export function buildSystemPrompt(brand: BrandBrain): string {
  const b = brand.business;
  const pos = brand.positioning;
  const voice = brand.voice;
  const rules = brand.contentRules;

  const services = b.services
    .filter((s) => s.isHighlight)
    .map((s) => `- ${s.name}: ${s.description}. Beneficio: ${s.benefit}`)
    .join('\n') || b.services.map((s) => `- ${s.name}`).join('\n');

  const valueProps = pos.valueProps.join(' | ');
  const personality = voice.personality.join(', ');
  const avoid = voice.avoid.length ? `Evitar siempre: ${voice.avoid.join(', ')}.` : '';
  const pillars = rules.contentPillars.length ? `Pilares de contenido: ${rules.contentPillars.join(', ')}.` : '';
  const ctas = rules.callToActions.length ? `CTAs aprobados: ${rules.callToActions.join(' | ')}` : '';
  const objections = brand.objections.length
    ? `Objeciones frecuentes y respuestas:\n${brand.objections.map((o) => `- "${o.objection}" → ${o.response}`).join('\n')}`
    : '';

  const painPoints = pos.targetAudience.painPoints.join(', ');
  const goals = pos.targetAudience.goals.join(', ');

  return `Eres el redactor de contenido de ${brand.name}, una empresa de ${b.industry} en ${b.location}.

SERVICIOS DESTACADOS:
${services}

POSICIONAMIENTO:
${valueProps ? `Propuestas de valor: ${valueProps}` : ''}
${pos.differentiators.length ? `Diferenciadores: ${pos.differentiators.join(' | ')}` : ''}

CLIENTE IDEAL:
Dolores: ${painPoints || 'no especificados'}
Objetivos: ${goals || 'no especificados'}

VOZ DE MARCA:
Personalidad: ${personality || 'profesional y confiable'}
Formalidad: ${voice.formality.replace('_', ' ')}
Idioma: ${voice.language === 'es' ? 'Español' : voice.language === 'en' ? 'Inglés' : 'Portugués'}
${avoid}

${pillars}
${ctas}
${objections}

REGLAS ABSOLUTAS:
- Escribir SIEMPRE en primera persona plural (nosotros) o segunda persona (tú/usted) según la formalidad
- NO inventar estadísticas ni testimonios falsos
- NO usar hashtags genéricos como #marketing #negocios
- Siempre incluir una llamada a la acción clara
- El contenido debe ser específico a ${b.industry}, no genérico`.trim();
}

export function buildUserPrompt(req: PostGenerationRequest): string {
  const formatLabels: Record<string, string> = {
    instagram_post: 'publicación de Instagram (feed)',
    instagram_story: 'historia de Instagram',
    facebook_post: 'publicación de Facebook',
    linkedin_post: 'publicación de LinkedIn (profesional)',
    twitter_post: 'tweet o hilo de Twitter/X',
  };

  return `Crea una ${formatLabels[req.format] || req.format} con el siguiente objetivo:

OBJETIVO: ${req.objective}
${req.topic ? `TEMA ESPECÍFICO: ${req.topic}` : ''}
${req.tone ? `TONO ADICIONAL: ${req.tone}` : ''}

Formato de respuesta JSON estricto:
{
  "caption": "texto completo del post con emojis apropiados y saltos de línea",
  "hashtags": ["hashtag1", "hashtag2"],
  "imagePrompt": "${req.withImage ? 'descripción visual detallada en inglés para generar la imagen del post' : ''}",
  "altText": "texto alternativo accesible para la imagen",
  "suggestedTime": "mejor hora de publicación (ej. Martes 7pm)"
}

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;
}

export function buildImagePrompt(caption: string, brand: BrandBrain, imagePromptFromAI: string): string {
  const colors = brand.identity?.colors;
  const colorContext = colors?.primary
    ? `Color scheme: ${colors.primary} primary, ${colors.accent ?? '#22d3ee'} accent.`
    : '';

  return `${imagePromptFromAI}. ${colorContext} Professional commercial photography style, clean modern aesthetic. High quality, photorealistic. No text, no logos, no watermarks.`;
}
