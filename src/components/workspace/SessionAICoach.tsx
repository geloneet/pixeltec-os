"use client";

import { useState, useEffect, useRef } from "react";
import type { WorkSession } from "@/types/session";
import type { CoachResponse } from "@/types/session";
import { MessageCircle, ChevronRight } from "lucide-react";

const COACH_QUESTIONS = [
  "¿Qué avance realizaste en esta actividad?",
  "¿Hubo algún problema o bloqueo?",
  "¿Necesitas documentar algo importante?",
  "¿Ya hiciste commit de tus cambios?",
  "¿Validaste el resultado en el navegador/móvil?",
  "¿Hay algo que el cliente necesita saber?",
  "¿Actualizaste el estado de la tarea?",
  "¿Quedaron tareas pendientes para la próxima sesión?",
];

interface Props {
  session: WorkSession;
  onResponseAdded: (response: CoachResponse) => void;
}

export function SessionAICoach({ session, onResponseAdded }: Props) {
  const [shownQuestions, setShownQuestions] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  const lastTriggerTime = useRef<number>(Date.now());
  const lastActivityCount = useRef<number>(session.activities.length);

  function triggerNextQuestion() {
    const unseen = COACH_QUESTIONS.filter((q) => !shownQuestions.includes(q));
    if (unseen.length === 0) return;
    if (currentQuestion !== null) return;
    const next = unseen[0]; // first unseen (deterministic)
    setCurrentQuestion(next);
  }

  // Trigger on new activity
  useEffect(() => {
    if (session.activities.length > lastActivityCount.current) {
      lastActivityCount.current = session.activities.length;
      triggerNextQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.activities.length]);

  // Timer trigger — check every 60s, fire if 20+ minutes since last trigger
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastTriggerTime.current > 20 * 60 * 1000) {
        lastTriggerTime.current = Date.now();
        triggerNextQuestion();
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownQuestions, currentQuestion]);

  const handleSubmit = () => {
    if (!currentQuestion || !answerText.trim()) return;
    const response: CoachResponse = {
      question: currentQuestion,
      answer: answerText.trim(),
      timestamp: new Date().toISOString(),
    };
    onResponseAdded(response);
    setShownQuestions((prev) => [...prev, currentQuestion]);
    setCurrentQuestion(null);
    setAnswerText("");
  };

  const handleDismiss = () => {
    if (!currentQuestion) return;
    setShownQuestions((prev) => [...prev, currentQuestion]);
    setCurrentQuestion(null);
  };

  return (
    <div className="bg-zinc-900/30 rounded-xl p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5 text-cyan-500/60 flex-shrink-0" />
        <span className="text-xs font-medium text-zinc-400">IA Coach</span>
      </div>

      {currentQuestion === null ? (
        /* Idle state */
        <p className="text-xs text-zinc-600 leading-relaxed">
          Las preguntas aparecerán durante la sesión
        </p>
      ) : (
        /* Active question card */
        <div className="space-y-2">
          <p className="text-sm text-zinc-200 leading-snug">{currentQuestion}</p>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Escribe tu respuesta..."
            rows={3}
            className="w-full bg-zinc-900/60 border border-white/[0.06] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 resize-none p-2 focus:outline-none focus:border-cyan-500/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!answerText.trim()}
              className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs px-3 py-1.5 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3 h-3" />
              Responder
            </button>
            <button
              onClick={handleDismiss}
              className="text-zinc-600 hover:text-zinc-400 text-xs px-3 py-1.5 transition-colors"
            >
              Omitir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
