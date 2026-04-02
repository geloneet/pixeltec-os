'use client';

/**
 * @fileoverview AI Agents Dashboard — PixelTEC OS
 *
 * Provides a UI to submit feature requests and watch the multi-agent
 * pipeline execute in real time, stage by stage.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Layers,
  Database,
  Code2,
  Monitor,
  TestTube2,
  ShieldCheck,
  Wrench,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { runFeaturePipeline } from '@/ai/orchestrators/feature-pipeline';
import type { PipelineContext } from '@/ai/types/agent-types';

// ─── Form Schema ──────────────────────────────────────────────────────────────

const FeatureFormSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description: z.string().min(20, 'Describe el feature con más detalle (mín. 20 caracteres)'),
  module: z.enum(['clients', 'projects', 'tasks', 'pipeline', 'finance', 'support', 'analytics', 'auth', 'global']),
  requestedBy: z.enum(['admin', 'developer', 'client']),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});
type FeatureFormData = z.infer<typeof FeatureFormSchema>;

// ─── Agent Pipeline Steps ─────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'product-owner',  label: 'Product Owner',       icon: Layers,      color: 'cyan',   desc: 'Genera spec, user stories y criterios de aceptación' },
  { id: 'project-planner', label: 'Project Planner',    icon: Bot,         color: 'blue',   desc: 'Descompone en tareas con dependencias y estimaciones' },
  { id: 'db-architect',   label: 'DB Architect',        icon: Database,    color: 'purple', desc: 'Diseña colecciones Firestore, índices y security rules' },
  { id: 'backend',        label: 'Backend Developer',   icon: Code2,       color: 'indigo', desc: 'Genera Server Actions, helpers y Zod schemas' },
  { id: 'frontend',       label: 'Frontend Developer',  icon: Monitor,     color: 'teal',   desc: 'Genera componentes React con design system Bento Dark' },
  { id: 'qa',             label: 'QA Tester',           icon: TestTube2,   color: 'yellow', desc: 'Crea casos de prueba, edge cases y riesgos de regresión' },
  { id: 'security',       label: 'Security Auditor',    icon: ShieldCheck, color: 'orange', desc: 'Audita vulnerabilidades antes del deploy' },
  { id: 'fixer',          label: 'Fixer Agent',         icon: Wrench,      color: 'red',    desc: 'Resuelve blockers encontrados por QA y Security' },
  { id: 'devops',         label: 'DevOps Agent',        icon: Rocket,      color: 'lime',   desc: 'Genera checklist de deploy y plan de rollback' },
] as const;

type StageStatus = 'idle' | 'running' | 'done' | 'skipped' | 'blocked';

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentsDashboardPage() {
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, StageStatus>>({});
  const [result, setResult] = useState<PipelineContext | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'spec' | 'plan' | 'schema' | 'security' | 'qa'>('spec');

  const form = useForm<FeatureFormData>({
    resolver: zodResolver(FeatureFormSchema),
    defaultValues: {
      requestedBy: 'admin',
      priority: 'medium',
      module: 'clients',
    },
  });

  const onSubmit = async (data: FeatureFormData) => {
    setIsRunning(true);
    setResult(null);
    setPipelineStatus({});

    // Simulate stage progression (real pipeline is async)
    const stages = PIPELINE_STAGES.map(s => s.id);
    for (const stage of stages) {
      setPipelineStatus(prev => ({ ...prev, [stage]: 'running' }));
    }

    try {
      const pipelineResult = await runFeaturePipeline(data);
      setResult(pipelineResult);

      // Mark stages based on result
      const finalStatuses: Record<string, StageStatus> = {};
      stages.forEach(s => {
        if (pipelineResult.status === 'blocked' && s === 'fixer') {
          finalStatuses[s] = 'blocked';
        } else if (!pipelineResult.fixes && s === 'fixer') {
          finalStatuses[s] = 'skipped';
        } else {
          finalStatuses[s] = 'done';
        }
      });
      setPipelineStatus(finalStatuses);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: StageStatus) => {
    switch (status) {
      case 'running': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30';
      case 'done':    return 'text-lime-400 bg-lime-400/10 border-lime-400/30';
      case 'blocked': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'skipped': return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30';
      default:        return 'text-zinc-600 bg-transparent border-white/5';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-5xl font-medium tracking-tight flex items-center gap-3">
            <Sparkles className="text-cyan-400 w-10 h-10" />
            AI Agents
          </h1>
          <p className="text-zinc-400 mt-2 text-base">
            Pipeline multi-agente para diseñar, construir y auditar features de PixelTEC OS.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-lime-400/10 border border-lime-400/20 rounded-full px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
          <span className="text-lime-400 text-xs font-semibold">Gemini 2.5 Flash</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-[2rem] border border-white/5 p-6">
            <h2 className="text-base font-semibold text-white mb-1">Nueva Solicitud de Feature</h2>
            <p className="text-zinc-500 text-xs mb-6">El pipeline ejecuta 9 agentes en secuencia automáticamente.</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-zinc-300 text-sm block mb-1.5">Título del Feature</label>
                <input
                  {...form.register('title')}
                  placeholder="Ej: Exportar facturas a PDF en bulk"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                />
                {form.formState.errors.title && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="text-zinc-300 text-sm block mb-1.5">Descripción detallada</label>
                <textarea
                  {...form.register('description')}
                  rows={4}
                  placeholder="Describe qué debe hacer el feature, quién lo usa y por qué es necesario..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 resize-none"
                />
                {form.formState.errors.description && (
                  <p className="text-red-400 text-xs mt-1">{form.formState.errors.description.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-300 text-sm block mb-1.5">Módulo</label>
                  <select
                    {...form.register('module')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="clients">Clientes</option>
                    <option value="projects">Proyectos</option>
                    <option value="tasks">Tareas</option>
                    <option value="pipeline">Pipeline</option>
                    <option value="finance">Finanzas</option>
                    <option value="support">Soporte</option>
                    <option value="analytics">Analytics</option>
                    <option value="global">Global</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-300 text-sm block mb-1.5">Prioridad</label>
                  <select
                    {...form.register('priority')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRunning}
                className="w-full bg-white text-black font-semibold rounded-full py-3 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ejecutando pipeline...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Ejecutar Pipeline de Agentes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: Pipeline Visualization */}
        <div className="lg:col-span-3">
          <div className="bg-black rounded-[2rem] border border-white/5 p-6">
            <h2 className="text-base font-semibold text-white mb-6">Pipeline de Agentes</h2>

            <div className="space-y-2">
              {PIPELINE_STAGES.map((stage, index) => {
                const status = pipelineStatus[stage.id] ?? 'idle';
                const Icon = stage.icon;

                return (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${getStatusColor(status)}`}
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      {status === 'running' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      ) : status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-lime-400" />
                      ) : status === 'blocked' ? (
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{stage.label}</span>
                        <span className="text-xs text-zinc-600 font-mono">#{index + 1}</span>
                      </div>
                      <p className="text-xs opacity-60 truncate">{stage.desc}</p>
                    </div>

                    {index < PIPELINE_STAGES.length - 1 && (
                      <ChevronRight className="w-4 h-4 opacity-20 flex-shrink-0" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black rounded-[2rem] border border-white/5 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                Resultados del Pipeline —{' '}
                <span className="text-cyan-400 font-mono">{result.spec?.featureId}</span>
              </h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                result.status === 'approved'
                  ? 'bg-lime-400/10 text-lime-400 border-lime-400/20'
                  : 'bg-red-400/10 text-red-400 border-red-400/20'
              }`}>
                {result.status.toUpperCase()}
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {(['spec', 'plan', 'schema', 'security', 'qa'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white bg-white/5'
                  }`}
                >
                  {tab === 'spec' ? 'Spec' : tab === 'plan' ? 'Plan' : tab === 'schema' ? 'DB Schema' : tab === 'security' ? 'Security' : 'QA'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/5 rounded-2xl p-5 font-mono text-xs text-zinc-300 overflow-auto max-h-[500px] whitespace-pre-wrap">
              {activeTab === 'spec' && result.spec && JSON.stringify(result.spec, null, 2)}
              {activeTab === 'plan' && result.plan && JSON.stringify(result.plan, null, 2)}
              {activeTab === 'schema' && result.schema && JSON.stringify(result.schema, null, 2)}
              {activeTab === 'security' && result.security && JSON.stringify(result.security, null, 2)}
              {activeTab === 'qa' && result.qa && JSON.stringify(result.qa, null, 2)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
