'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OTPInput from '@/components/portal/OTPInput';
import {
  requestPortalCodeAction,
  verifyPortalCodeAction,
} from '@/app/actions';
import { savePortalSession } from '@/lib/portal';

type Phase = 'idle' | 'sending' | 'code-sent' | 'verifying' | 'error-code' | 'expired';

interface Props {
  slug: string;
  companyName: string;
}

export default function PortalEntryClient({ slug, companyName }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleRequestCode = async () => {
    setPhase('sending');
    setErrorMsg('');
    const res = await requestPortalCodeAction(slug);
    if (res.success && res.data) {
      setMaskedEmail(res.data.maskedEmail);
      setCode('');
      setPhase('code-sent');
      startCountdown(60);
    } else {
      setErrorMsg(res.error ?? 'Error al enviar el código.');
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (code.replace(/\D/g, '').length === 6 && phase === 'code-sent') {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleVerify = async () => {
    setPhase('verifying');
    setErrorMsg('');
    const res = await verifyPortalCodeAction(slug, code);
    if (res.success && res.data) {
      savePortalSession({ ...res.data, validatedAt: Date.now() });
      router.push(`/${slug}/dashboard`);
    } else {
      const msg = res.error ?? 'Error al validar.';
      setErrorMsg(msg);
      setCode('');
      setPhase(msg.includes('expiró') ? 'expired' : 'error-code');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <p className="text-2xl font-bold tracking-tight text-white">
          Pixel<span className="text-cyan-400">TEC</span>
        </p>
        <p className="text-xs text-zinc-600 mt-1 uppercase tracking-[3px]">Portal de Clientes</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="relative rounded-2xl border border-white/8 bg-[#111111] overflow-hidden shadow-2xl">
          <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-lime-400" />
          <div className="p-8 sm:p-10">
            <div className="mb-8">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Acceso Seguro
              </p>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {companyName}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {phase === 'code-sent' || phase === 'verifying' || phase === 'error-code' || phase === 'expired'
                  ? `Código enviado a ${maskedEmail}`
                  : 'Solicita tu código de acceso para continuar.'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {(phase === 'idle' || phase === 'sending') && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="space-y-4">
                  {errorMsg && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {errorMsg}
                    </div>
                  )}
                  <Button
                    onClick={handleRequestCode}
                    disabled={phase === 'sending'}
                    className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm rounded-xl"
                  >
                    {phase === 'sending' ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando código...</>
                    ) : (
                      <><Mail className="mr-2 h-4 w-4" />Enviar Código por Email</>
                    )}
                  </Button>
                </motion.div>
              )}

              {(phase === 'code-sent' || phase === 'verifying' || phase === 'error-code' || phase === 'expired') && (
                <motion.div key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} className="space-y-6">
                  {phase === 'error-code' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {errorMsg || 'Código incorrecto. Inténtalo de nuevo.'}
                    </div>
                  )}
                  {phase === 'expired' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      El código expiró. Solicita uno nuevo.
                    </div>
                  )}
                  <OTPInput
                    value={code}
                    onChange={setCode}
                    disabled={phase === 'verifying'}
                    hasError={phase === 'error-code'}
                  />
                  <Button
                    onClick={handleVerify}
                    disabled={code.replace(/\D/g,'').length < 6 || phase === 'verifying'}
                    className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl"
                  >
                    {phase === 'verifying' ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
                    ) : (
                      <><ArrowRight className="mr-2 h-4 w-4" />Ingresar al Portal</>
                    )}
                  </Button>
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-xs text-zinc-600">
                        Reenviar código en <span className="tabular-nums text-zinc-500">{countdown}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={() => { setPhase('idle'); setCode(''); setErrorMsg(''); }}
                        className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-1 mx-auto"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Solicitar nuevo código
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-700 mt-6">
          Acceso seguro · Los códigos expiran en 10 minutos
        </p>
      </motion.div>
    </main>
  );
}
