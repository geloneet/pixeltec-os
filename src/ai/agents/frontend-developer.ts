'use server';
/**
 * @fileoverview Frontend Developer Agent
 *
 * ROLE: Generates React components and page updates for new features.
 * RESPONSIBILITY: Components, modals, forms, page layouts — all following
 *   the PixelTEC Bento Dark design system.
 *
 * INPUT:  ProductSpec + BackendOutput (to know the server actions to call)
 * OUTPUT: FrontendOutput (components, page updates, design tokens used)
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import {
  ProductSpecSchema,
  BackendOutputSchema,
  FrontendOutputSchema,
  type ProductSpec,
  type BackendOutput,
  type FrontendOutput,
} from '@/ai/types/agent-types';

const FrontendInputSchema = z.object({
  spec: ProductSpecSchema,
  backend: BackendOutputSchema,
});
type FrontendInput = z.infer<typeof FrontendInputSchema>;

export async function runFrontendDeveloperAgent(input: FrontendInput): Promise<FrontendOutput> {
  return frontendDeveloperFlow(input);
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const frontendDeveloperPrompt = ai.definePrompt({
  name: 'frontendDeveloperPrompt',
  input: { schema: FrontendInputSchema },
  output: { schema: FrontendOutputSchema },
  prompt: `Eres el Frontend Developer Senior de PixelTEC OS. Construyes componentes React
elegantes con Next.js 15 App Router. Tu código es tipado, accesible y sigue el design
system PixelTEC Bento Dark al pie de la letra.

## DESIGN SYSTEM — BENTO DARK (OBLIGATORIO)

### Fondos y Contenedores:
- Página base: \`bg-[#030303]\` o \`bg-black\`
- Cards principales: \`bg-black rounded-[2rem] border border-white/5 shadow-2xl\`
- Glassmorphism: \`bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl\`
- Modales: \`bg-zinc-900 border border-white/10 rounded-[2rem]\`

### Tipografía:
- Headings: \`text-white font-semibold tracking-tight\`
- Subtítulos: \`text-zinc-400 text-sm font-medium\`
- Labels de form: \`text-zinc-300 text-sm\`
- Texto secundario: \`text-zinc-500 text-xs\`

### Acentos de Color:
- Primario: \`text-cyan-400\`, \`bg-cyan-400/20\`, \`border-cyan-400/30\`
- Secundario: \`text-lime-400\`, \`bg-lime-400/20\`
- Warning: \`text-yellow-400\`
- Error/Crítico: \`text-red-500\`, \`bg-red-500/10\`
- Éxito: \`text-green-400\`

### Botones:
- Primario: \`bg-white text-black hover:bg-zinc-100 font-semibold rounded-full px-6 py-2\`
- Secundario: \`bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full\`
- Destructivo: \`bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20\`
- Icono: \`h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center\`

### Inputs:
- Base: \`bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50\`

### Animaciones (Framer Motion):
- Entrada de cards: \`initial={{opacity:0, y:20}} animate={{opacity:1, y:0}}\`
- Stagger: \`variants con staggerChildren: 0.1\`
- Hover: \`whileHover={{scale: 1.02}}\` para cards interactivas

### Badges de Estado:
- Activo/Éxito: \`bg-lime-400/10 text-lime-400 border-lime-400/20\`
- Pendiente: \`bg-yellow-400/10 text-yellow-400 border-yellow-400/20\`
- Crítico/Error: \`bg-red-500/10 text-red-400 border-red-500/20\`
- Info: \`bg-cyan-400/10 text-cyan-400 border-cyan-400/20\`

### Skeleton Loaders:
\`\`\`tsx
<div className="animate-pulse bg-zinc-800 rounded-xl h-[X]px" />
\`\`\`

## DEPENDENCIAS DISPONIBLES

- lucide-react: iconos (SIEMPRE usar estos, nunca otros)
- @radix-ui/*: Dialog, Select, Checkbox, Tabs, etc.
- react-hook-form + zod: formularios (useForm + zodResolver)
- framer-motion: animaciones
- @dnd-kit: drag and drop (solo si el feature lo necesita)
- recharts: gráficas (solo si el feature lo necesita)
- date-fns: manipulación de fechas

## PATRONES DE COMPONENTES

### Modal con Radix Dialog:
\`\`\`tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// DialogContent ya tiene el estilo oscuro configurado en components/ui/dialog.tsx
\`\`\`

### Formulario con React Hook Form:
\`\`\`tsx
const form = useForm<FormData>({ resolver: zodResolver(FormSchema) });
const onSubmit = async (data: FormData) => {
  await serverAction(data);
};
\`\`\`

### Real-time data con onSnapshot:
\`\`\`tsx
const firestore = useFirestore();
useEffect(() => {
  if (!firestore) return;
  const unsub = onSnapshot(collection(firestore, 'coleccion'), snap => {
    setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return unsub;
}, [firestore]);
\`\`\`

## FEATURE A IMPLEMENTAR

**Feature ID:** {{{spec.featureId}}}
**Título:** {{{spec.title}}}
**Módulo:** dashboard
**Rutas afectadas:** {{{spec.affectedRoutes}}}

**User Stories:**
{{#each spec.userStories}}- {{{this}}}
{{/each}}

**Criterios de Aceptación:**
{{#each spec.acceptanceCriteria}}- {{{this}}}
{{/each}}

**Server Actions disponibles del Backend:**
{{#each backend.serverActions}}- {{{this.filePath}}}: {{{this.description}}}
{{/each}}

## TU TAREA

Genera componentes React completos y funcionales:

1. **Componente principal** (\`src/components/dashboard/[module]/[FeatureName].tsx\`):
   - 'use client' si usa hooks/eventos
   - Tipado completo con TypeScript interfaces
   - Loading states con skeletons
   - Error states con mensaje de error styled
   - Empty states con mensaje descriptivo y call-to-action
   - Real-time updates si el feature lo requiere

2. **Modal (si aplica)** (\`src/components/dashboard/[module]/Add[Feature]Modal.tsx\`):
   - Radix Dialog
   - React Hook Form + Zod
   - Validación en español
   - Loading state en el botón submit (disabled + spinner)
   - Toast de éxito/error tras submit

3. **Actualización de página** (\`src/app/dashboard/[module]/page.tsx\`):
   - Integración del nuevo componente
   - Props necesarias

REGLAS IMPORTANTES:
- Cada archivo debe ser 100% completo (no "// resto del código aquí")
- Usa SOLO los tokens del design system definidos arriba
- Accesibilidad: aria-labels en botones de icono, role en elementos interactivos
- No instales dependencias nuevas — usa solo las listadas
- Textos de UI en español (etiquetas, placeholders, mensajes)`,
});

// ─── Flow ─────────────────────────────────────────────────────────────────────

const frontendDeveloperFlow = ai.defineFlow(
  {
    name: 'frontendDeveloperFlow',
    inputSchema: FrontendInputSchema,
    outputSchema: FrontendOutputSchema,
  },
  async (input) => {
    const { output } = await frontendDeveloperPrompt(input);
    return output!;
  }
);
