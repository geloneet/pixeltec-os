'use client';

import { useState } from 'react';
import { BrainCircuit, LoaderCircle, Sparkles } from 'lucide-react';
import { getAIAdvisorSuggestions } from '@/app/actions';
import type { StrategicAdvisorInput } from '@/ai/flows/strategic-advisor';
import { ShinyButton } from '../ui/shiny-button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface AIAdvisorProps {
  clientContext: StrategicAdvisorInput;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function AIAdvisor({ clientContext }: AIAdvisorProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setStatus('loading');
    setSuggestions([]);
    
    const result = await getAIAdvisorSuggestions(clientContext);

    if (result.success && result.data) {
      setSuggestions(result.data.suggestions);
      setStatus('success');
    } else {
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'Error de Análisis',
        description: result.error || 'No se pudieron generar las sugerencias.',
      });
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center text-center p-8 text-zinc-400">
            <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
            <p className="font-semibold text-lg">Analizando contexto...</p>
            <p className="text-sm text-zinc-500">La IA está procesando las notas y tareas para generar insights.</p>
          </div>
        );
      case 'success':
        return (
          <div className="p-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="text-cyan-400" />
                Propuestas Estratégicas
            </h3>
            <ul className="space-y-3 list-disc list-inside text-zinc-300">
              {suggestions.map((suggestion, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.15 }}
                >
                  {suggestion}
                </motion.li>
              ))}
            </ul>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center justify-center p-8 text-red-400">
            <p>Hubo un error al contactar al asistente de IA. Inténtalo de nuevo.</p>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <BrainCircuit className="h-12 w-12 text-zinc-600 mb-4" />
            <h3 className="text-xl font-bold text-white">Asistente Estratégico IA</h3>
            <p className="text-zinc-400 mt-2 mb-6 max-w-sm">Analiza el estado actual del cliente para identificar oportunidades de innovación y automatización.</p>
            <ShinyButton onClick={handleAnalysis} disabled={status !== 'idle'}>
              Analizar Situación Actual
            </ShinyButton>
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
