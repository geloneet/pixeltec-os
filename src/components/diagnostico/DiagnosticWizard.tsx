'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { DiagnosticResult } from '@/lib/diagnostic/logic';
import { submitDiagnostic } from '@/app/actions';
import { DiagnosticStepper } from './DiagnosticStepper';
import { StepWelcome } from './steps/StepWelcome';
import { StepCompanyType } from './steps/StepCompanyType';
import { StepProblems } from './steps/StepProblems';
import { StepCompanySize } from './steps/StepCompanySize';
import { StepPriority } from './steps/StepPriority';
import { StepContact } from './steps/StepContact';
import { StepResult } from './steps/StepResult';
import { DEFAULT_WIZARD_ANSWERS, type WizardAnswers } from './types';

const STEP_WELCOME = 0;
const STEP_COMPANY_TYPE = 1;
const STEP_PROBLEMS = 2;
const STEP_COMPANY_SIZE = 3;
const STEP_PRIORITY = 4;
const STEP_CONTACT = 5;
const STEP_RESULT = 6;

interface Props {
  variant?: 'modal' | 'page';
  initialIndustry?: string;
  onClose?: () => void;
}

export function DiagnosticWizard({ variant = 'page', initialIndustry, onClose }: Props) {
  const [step, setStep] = useState(STEP_WELCOME);
  const [answers, setAnswers] = useState<WizardAnswers>(() => ({
    ...DEFAULT_WIZARD_ANSWERS,
    companyType: initialIndustry ?? '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);

  function update(updates: Partial<WizardAnswers>) {
    setAnswers((prev) => ({ ...prev, ...updates }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, STEP_RESULT));
  }

  function back() {
    setSubmitError(null);
    setStep((s) => Math.max(s - 1, STEP_WELCOME));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitDiagnostic({
        name: answers.name,
        email: answers.email,
        phone: answers.phone || undefined,
        empresa: answers.empresa || undefined,
        companyType: answers.companyType,
        problems: answers.problems,
        companySize: answers.companySize,
        priority: answers.priority,
        consent: answers.consent ? 'on' : '',
        website: answers.website,
      });
      if (res.ok) {
        setResult(res.result);
        setLeadId(res.leadId);
        setStep(STEP_RESULT);
      } else {
        // HOTFIX (code review 2026-07-09): antes esto mostraba un resultado
        // calculado en cliente y avanzaba a STEP_RESULT — el visitante veía
        // una pantalla de "éxito" aunque el lead nunca se hubiera guardado
        // ni el equipo hubiera sido notificado. Ahora nos quedamos en
        // STEP_CONTACT, donde `errorMessage` sí se renderiza y el visitante
        // puede reintentar o usar el link de WhatsApp de respaldo.
        setSubmitError(res.message);
      }
    } catch {
      setSubmitError('Ocurrió un error inesperado. Inténtalo de nuevo o contáctanos directo por WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  }

  const showStepper = step >= STEP_COMPANY_TYPE && step <= STEP_CONTACT;
  const showBack = step > STEP_WELCOME && step < STEP_RESULT;

  return (
    <div
      className={
        variant === 'modal'
          ? 'w-full max-h-[85vh] overflow-y-auto p-1'
          : 'w-full max-w-2xl mx-auto'
      }
    >
      <div className="rounded-2xl border border-white/5 bg-[#0A0A0A] p-6 sm:p-8">
        {showBack && (
          <button
            type="button"
            onClick={back}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Volver
          </button>
        )}

        {showStepper && <DiagnosticStepper currentStep={step - STEP_COMPANY_TYPE} />}

        {step === STEP_WELCOME && <StepWelcome onNext={next} />}
        {step === STEP_COMPANY_TYPE && <StepCompanyType answers={answers} update={update} onNext={next} />}
        {step === STEP_PROBLEMS && <StepProblems answers={answers} update={update} onNext={next} />}
        {step === STEP_COMPANY_SIZE && <StepCompanySize answers={answers} update={update} onNext={next} />}
        {step === STEP_PRIORITY && <StepPriority answers={answers} update={update} onNext={next} />}
        {step === STEP_CONTACT && (
          <StepContact
            answers={answers}
            update={update}
            onSubmit={handleSubmit}
            submitting={submitting}
            errorMessage={submitError}
          />
        )}
        {step === STEP_RESULT && result && (
          <>
            <StepResult result={result} answers={answers} leadId={leadId} />
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cerrar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
