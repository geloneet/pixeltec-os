'use client';

import { useState } from 'react';
import { BrainCircuit, LoaderCircle, Sparkles, Zap, PlusCircle, CheckCircle2 } from 'lucide-react';
import { getGlobalAIInsights } from '@/app/actions';
import type { GlobalStrategicInsightsOutput } from '@/ai/flows/global-strategic-advisor';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface AIPredictionsProps {
  allNotes: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';
type Insight = {
    clientName: string;
    type: "alert" | "suggestion";
    text: string;
}

export default function AIPredictions({ allNotes }: AIPredictionsProps) {
  const firestore = useFirestore();
  const [status, setStatus] = useState<Status>('idle');
  const [insights, setInsights] = useState<Insight[]>([]);
  const [createdTasks, setCreatedTasks] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setStatus('loading');
    setInsights([]);
    
    const result = await getGlobalAIInsights({ allNotes });

    if (result.success && result.data?.insights) {
      setInsights(result.data.insights);
      setStatus('success');
    } else {
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'Error de Análisis Global',
        description: result.error || 'No se pudieron generar los insights.',
      });
    }
  };
  
  const handleCreateTask = async (insight: Insight, index: number) => {
    if (!firestore) return;
    try {
      const title = `[IA] ${insight.clientName}: ${insight.text.substring(0, 90)}${insight.text.length > 90 ? '...' : ''}`;
      await addDoc(collection(firestore, 'tasks'), {
        title,
        responsible: 'Miguel',
        status: 'Pendiente',
        createdAt: serverTimestamp(),
        dueDate: null,
        source: 'ai-insight',
        clientName: insight.clientName,
      });
      setCreatedTasks(prev => new Set(prev).add(index));
      toast({
        title: '✓ Tarea creada',
        description: `Asignada para: ${insight.clientName}`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error al crear tarea',
        description: 'No se pudo guardar la tarea. Intenta de nuevo.',
      });
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
            <p className="font-semibold text-lg">Analizando ecosistema...</p>
            <p className="text-sm text-zinc-500">El consultor IA está revisando las notas de todos los clientes.</p>
          </div>
        );
      case 'success':
        return (
          <div className="p-6 md:p-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="text-cyan-400" />
                Insights del Ecosistema
            </h3>
            {insights.length === 0 ? (
                 <p className="text-center text-zinc-500 py-8">La IA no ha detectado alertas o sugerencias urgentes en este momento.</p>
            ) : (
                <ul className="space-y-4">
                {insights.map((insight, index) => {
                    const isCreated = createdTasks.has(index);
                    return (
                    <motion.li
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.2 }}
                    className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-lg bg-white/5 border border-white/10"
                    >
                        <Zap className={`h-6 w-6 flex-shrink-0 mt-1 ${insight.type === 'alert' ? 'text-red-400' : 'text-yellow-400'}`} />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-white">{insight.clientName}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                    insight.type === 'alert'
                                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                        : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                                }`}>
                                    {insight.type === 'alert' ? 'Alerta' : 'Sugerencia'}
                                </span>
                            </div>
                            <p className="text-zinc-300 text-sm mt-1">{insight.text}</p>
                        </div>
                        <Button
                            onClick={() => !isCreated && handleCreateTask(insight, index)}
                            disabled={isCreated}
                            size="sm"
                            variant="ghost"
                            className={`w-full sm:w-auto mt-2 sm:mt-0 transition-colors ${
                                isCreated
                                    ? 'text-lime-400 cursor-default'
                                    : 'text-cyan-400 hover:bg-cyan-900/50 hover:text-cyan-300'
                            }`}
                        >
                            {isCreated ? (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Tarea creada</>
                            ) : (
                                <><PlusCircle className="mr-2 h-4 w-4" />Crear Tarea</>
                            )}
                        </Button>
                    </motion.li>
                    );
                })}
                </ul>
            )}
            <div className="text-center mt-6">
                <Button variant="outline" onClick={handleAnalysis} className="border-white/20 hover:bg-white/10">Re-analizar</Button>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-red-400 text-center">
            <p className="mb-4">Hubo un error al contactar al consultor de IA.</p>
            <Button variant="outline" onClick={handleAnalysis}>Intentar de Nuevo</Button>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <BrainCircuit className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-xl font-bold text-white">Consultor de Estrategia Global</h3>
            <p className="text-zinc-400 mt-2 mb-6 max-w-sm">La IA analizará las notas de todos los clientes para detectar patrones, cuellos de botella y oportunidades de mejora.</p>
            <Button onClick={handleAnalysis} disabled={status !== 'idle'} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
              Analizar Ecosistema
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="relative lg:col-span-3 bg-black rounded-[2rem] border border-white/5 p-0 shadow-2xl overflow-hidden min-h-[20rem] flex items-center justify-center">
      {/* Glowing border effect */}
      <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/30 to-transparent opacity-50"></div>
          <div className="absolute top-0 left-0 h-1/2 w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/20 to-transparent blur-2xl"></div>
      </div>
      
      <div className="relative z-10 w-full">
         <AnimatePresence mode="wait">
            <motion.div
                key={status}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
            >
                {renderContent()}
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
