'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, RefreshCw, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OTPInput from '@/components/portal/OTPInput';
import {
  checkPortalSlugAction,
  requestPortalCodeAction,
  verifyPortalCodeAction,
} from '@/app/actions';
import { savePortalSession } from '@/lib/portal';

type Phase = 'loading' | 'not-found' | 'idle' | 'sending' | 'code-sent' | 'verifying' | 'error-code' | 'expired';

export default function PortalEntryPage() {
  const params  = useParams();
  const router  = useRouter();
  const slug    = (params.slug as string) ?? '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [companyName, setCompanyName] = useState('');
  const [maskedEmail, setMaskedEmail]   = useState('');
  const [code, setCode]   = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Check slug on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setPhase('not-found'); return; }
    checkPortalSlugAction(slug).then(res => {
      if (res.success && res.data) {
        setCompanyName(res.data.companyName);
        setPhase('idle');
      } else {
        setPhase('not-found');
      }
    });
  }, [slug]);

  // ── Countdown timer ────────────────────────────────────────────────────────
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

  // ── Request code ───────────────────────────────────────────────────────────
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

  // ── Verify code (auto-submit when 6 digits entered) ───────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Logo */}
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

      <AnimatePresence mode="wait">

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 text-zinc-500">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
            <p className="text-sm">Verificando portal...</p>
          </motion.div>
        )}

        {/* ── Not found ── */}
        {phase === 'not-found' && (
          <motion.div key="notfound" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-3">
            <p className="text-5xl">🔍</p>
            <h1 className="text-xl font-bold text-white">Portal no encontrado</h1>
            <p className="text-zinc-500 text-sm max-w-xs">
              El enlace que usaste no corresponde a ningún portal activo.
              Contacta a tu equipo de PixelTEC.
            </p>
          </motion.div>
        )}

        {/* ── Main card ── */}
        {(phase !== 'loading' && phase !== 'not-found') && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <div className="relative rounded-2xl border border-white/8 bg-[#111111] overflow-hidden shadow-2xl">
              {/* Top accent bar */}
              <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-lime-400" />

              <div className="p-8 sm:p-10">

                {/* Header */}
                <div className="mb-8">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                    Acceso Seguro
                  </p>
                  <h1 className="text-2xl font-bold text-white leading-tight">
                    {companyName || 'Tu Portal'}
                  </h1>
                  <p className="text-sm text-zinc-500 mt-1">
                    {phase === 'code-sent' || phase === 'verifying' || phase === 'error-code' || phase === 'expired'
                      ? `Código enviado a ${maskedEmail}`
                      : 'Solicita tu código de acceso para continuar.'}
                  </p>
                </div>

                <AnimatePresence mode="wait">

                  {/* ── Idle / request code ── */}
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

                  {/* ── Code input ── */}
                  {(phase === 'code-sent' || phase === 'verifying' || phase === 'error-code' || phase === 'expired') && (
                    <motion.div key="otp" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }} className="space-y-6">

                      {/* Error / expired banners */}
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

                      {/* OTP */}
                      <OTPInput
                        value={code}
                        onChange={setCode}
                        disabled={phase === 'verifying'}
                        hasError={phase === 'error-code'}
                      />

                      {/* Submit (auto-submits, manual fallback) */}
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

                      {/* Resend */}
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
        )}

      </AnimatePresence>
    </main>
  );
}
