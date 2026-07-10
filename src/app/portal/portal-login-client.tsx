'use client';

import { useState, useEffect, useRef } from 'react';
import { Mail, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { requestClientPortalCodeAction, verifyClientPortalCodeAction } from '@/lib/client-portal/auth-actions';

type Phase = 'idle' | 'sending' | 'code-sent' | 'verifying' | 'error-code';

export function PortalLoginClient() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startCountdown = (seconds = 60) => {
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || phase === 'sending') return;
    setPhase('sending');
    setMessage(null);
    const result = await requestClientPortalCodeAction(email);
    if (result.success && result.data) {
      setMessage(result.data.message);
      setPhase('code-sent');
      startCountdown(60);
    } else {
      setMessage(result.error ?? 'No se pudo enviar el código.');
      setPhase('idle');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || phase === 'verifying') return;
    setPhase('verifying');
    setMessage(null);
    const result = await verifyClientPortalCodeAction(email, code);
    if (result.success) {
      window.location.assign('/portal');
      return;
    }
    setMessage(result.error ?? 'No se pudo verificar el código.');
    setCode('');
    setPhase('error-code');
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-zinc-950">
      <div className="mb-10 text-center">
        <p className="text-2xl font-bold tracking-tight text-white">
          Pixel<span className="text-cyan-400">TEC</span>
        </p>
        <p className="text-xs text-zinc-600 mt-1 uppercase tracking-[3px]">Portal de Clientes</p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-[#111111] overflow-hidden shadow-2xl">
        <div className="h-[2px] w-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-lime-400" />
        <div className="p-8 sm:p-10">
          {phase === 'idle' || phase === 'sending' ? (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <p className="text-sm text-zinc-500 mb-2">Ingresa tu correo para recibir un código de acceso.</p>
              {message && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {message}
                </div>
              )}
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="email"
                  required
                  autoFocus
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={phase === 'sending'}
                  className="h-12 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
                />
              </div>
              <Button
                type="submit"
                disabled={phase === 'sending'}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl"
              >
                {phase === 'sending' ? (
                  <><Spinner size="sm" className="mr-2" />Enviando código…</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Enviar código por email</>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {message && (
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                    phase === 'error-code'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                  }`}
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {message}
                </div>
              )}
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={phase === 'verifying'}
                className="h-14 w-full rounded-lg border-white/10 bg-black/50 text-center text-2xl tracking-[0.5em] text-white"
              />
              <Button
                type="submit"
                disabled={code.length !== 6 || phase === 'verifying'}
                className="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl"
              >
                {phase === 'verifying' ? (
                  <><Spinner size="sm" className="mr-2" />Verificando…</>
                ) : (
                  <><ArrowRight className="mr-2 h-4 w-4" />Ingresar</>
                )}
              </Button>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-zinc-600">
                    Reenviar código en <span className="tabular-nums text-zinc-500">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setPhase('idle'); setCode(''); setMessage(null); }}
                    className="text-xs text-zinc-500 hover:text-cyan-400 flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Solicitar nuevo código
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
