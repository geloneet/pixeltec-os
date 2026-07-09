'use client';

import { memo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Users, Terminal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { loginLegacyPortal } from '@/lib/portal/legacy-auth';
import { requestPasswordResetAction } from '@/app/actions';
import { ObfuscatedMailto } from '@/components/ui/obfuscated-mailto';

const TEAM_EMAIL = 'equipo@pixeltec.mx';

type LoginMode = 'picker' | 'cliente' | 'dev';

function modeFromParam(param: string | null): LoginMode {
  if (param === 'cliente') return 'cliente';
  if (param === 'dev') return 'dev';
  return 'picker';
}

// Decorative backdrop shared by both columns — memoized so the grid + glow
// never repaint when the form's state changes (every keystroke would
// otherwise trigger a React reconcile pass on this subtree). Masked so it
// reads strongest on the left third of the screen (the visual panel) and
// fades out before it reaches the form, staying just a faint touch on mobile
// where the dedicated visual panel is hidden entirely.
const LoginBackdrop = memo(function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full opacity-70"
        style={{
          WebkitMaskImage:
            'radial-gradient(ellipse 900px 800px at 15% 45%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 45%, transparent 75%)',
          maskImage:
            'radial-gradient(ellipse 900px 800px at 15% 45%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 45%, transparent 75%)',
        }}
      >
        <defs>
          <pattern id="login-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(33,150,243,0.09)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>

      {/* Breathing glow — low FPS, very slow, never distracting */}
      <motion.div
        className="absolute -left-24 -top-24 h-[550px] w-[550px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(33,150,243,0.20) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -left-16 bottom-[-120px] h-[420px] w-[420px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(33,150,243,0.14) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.1, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
    </div>
  );
});

// Terminal-style blinking cursor. Memoized so the framer animation isn't
// restarted on every parent render.
const BlinkingCursor = memo(function BlinkingCursor() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-1 inline-block text-primary"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      ▊
    </motion.span>
  );
});

const ROTATING_WORDS = ['Tecnología', 'Eficiencia', 'Estratégicos', 'Automatización', 'PixelTEC'];
const ROTATING_WORD_INTERVAL_MS = 2800;

// Slow word-cycling label ("Somos // <word>"). Starts at a fixed index (0)
// so server and client render the same word on first paint — no hydration
// mismatch — then advances client-side only via setInterval.
const RotatingWord = memo(function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, ROTATING_WORD_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={ROTATING_WORDS[index]}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="inline-block"
      >
        {ROTATING_WORDS[index]}
      </motion.span>
    </AnimatePresence>
  );
});

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  // Delay-guard: solo escala a pantalla completa si el submit tarda más de
  // ~400ms. Un login que falla rápido (o tiene éxito rápido, ya que
  // isLoading se mantiene true hasta que el navegador navega) nunca llega a
  // mostrar nada nuevo — evita el flicker que ya se había resuelto antes.
  const [showDelayedLoader, setShowDelayedLoader] = useState(false);

  // "¿Olvidaste tu contraseña?" — solo aplica a modo 'dev' (tabla `users` /
  // NextAuth). El portal de clientes (modo 'cliente') usa su propio acceso
  // passwordless por slug + código OTP, no contraseña.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const [mode, setMode] = useState<LoginMode>(() => modeFromParam(searchParams.get('modo')));
  const { data: session, status } = useSession();

  // Redirect if already logged in vía NextAuth (equipo interno). Independiente
  // del modo que se esté mostrando: si ya hay sesión de staff válida, no tiene
  // sentido mostrarle el selector ni ningún formulario.
  // Skip during an active login submit to avoid racing con el redirect propio.
  useEffect(() => {
    if (isLoading || isRedirecting) return;

    if (status === 'authenticated' && session?.user) {
      setIsRedirecting(true);
      window.location.assign(redirectParam || '/hoy');
    }
  }, [status, session, isLoading, isRedirecting, redirectParam]);

  useEffect(() => {
    if (!isLoading) {
      setShowDelayedLoader(false);
      return;
    }
    const timer = setTimeout(() => setShowDelayedLoader(true), 400);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const selectMode = (next: LoginMode) => {
    setError(null);
    setEmail('');
    setPassword('');
    setForgotOpen(false);
    setForgotMessage(null);
    setMode(next);
  };

  const handleForgotSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (forgotSubmitting) return;
    setForgotSubmitting(true);
    setForgotMessage(null);
    try {
      const { message } = await requestPasswordResetAction(forgotEmail);
      setForgotMessage(message);
    } catch {
      setForgotMessage('Si el correo existe en nuestro sistema, te enviamos instrucciones para restablecer tu contraseña.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    // Honeypot — silent no-op: looks like the form is processing,
    // but no se llama a ningún backend real.
    if (honeypot.trim() !== '') {
      setIsLoading(true);
      await new Promise((r) => setTimeout(r, 500));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'cliente') {
        // Portal legado de clientes — auth propio contra Postgres (Fase D
        // retiro Firebase), no NextAuth.
        const result = await loginLegacyPortal(email, password);
        if (result.ok) {
          setIsRedirecting(true);
          window.location.assign('/portal');
          return;
        }
        setError(result.error ?? 'No se pudo iniciar sesión.');
        setIsLoading(false);
        return;
      }

      // Equipo interno (admin/staff) — NextAuth contra Postgres.
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (!result?.error) {
        setIsRedirecting(true);
        window.location.assign(redirectParam || '/hoy');
        return;
      }

      setError('El correo electrónico o la contraseña son incorrectos.');
      setIsLoading(false);
    } catch {
      setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.');
      setIsLoading(false);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  // Show a loading screen while session state is being determined, while an
  // already-authenticated visitor is being redirected, or — with a ~400ms
  // delay-guard — while an active submit is taking a while. A login that
  // fails (or succeeds) fast never reaches this: swapping the form for this
  // screen mid-login is what caused the unmount → full-screen spinner →
  // re-mount flicker this delay-guard is designed to avoid.
  const showFullScreenLoader =
    (!isLoading && (isRedirecting || status === 'loading')) || (isLoading && showDelayedLoader);

  if (showFullScreenLoader) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-zinc-950 text-white p-4">
        <Spinner size="lg" className="text-primary" />
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Cargando sistema…</p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-zinc-950 text-white md:flex-row">
      <LoginBackdrop />

      {/* Left — visual panel, tablet+. Pure composition, no form here. */}
      <div className="relative hidden md:flex md:w-1/2 lg:w-[58%] flex-col items-center justify-center px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16"
          />
          <h2 className="mt-6 font-logo text-5xl font-extrabold uppercase tracking-tighter text-white">
            PixelTEC
          </h2>
          <p className="mt-3 font-mono text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
            <span>Somos</span>
            <span className="mx-2 text-primary">//</span>
            <RotatingWord />
            <BlinkingCursor />
          </p>
        </motion.div>
      </div>

      {/* Right — form panel. Straight, clean divider from the visual panel. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 md:w-1/2 md:flex-none md:border-l md:border-white/[0.06] md:px-10 lg:w-[42%] lg:px-16">
        <div className="relative z-10 w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="flex justify-center md:justify-start"
          >
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_URL!}
              alt="PixelTEC"
              width={48}
              height={48}
              className="h-12 w-12"
            />
          </motion.div>

          <AnimatePresence mode="wait">
            {mode === 'picker' ? (
              <motion.div
                key="picker"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <h1 className="mt-6 text-center font-logo text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-left">
                  Acceso
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-400 md:text-left">
                  Elige cómo quieres ingresar
                </p>

                <div className="mt-10 space-y-3">
                  <button
                    type="button"
                    onClick={() => selectMode('cliente')}
                    className="group flex w-full items-center gap-4 rounded-lg border border-white/10 bg-black/50 px-5 py-4 text-left transition-colors duration-200 hover:border-primary/50 hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-white">Acceso Clientes</span>
                      <span className="block text-xs text-zinc-500">Proyectos, facturas y soporte</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors duration-200 group-hover:text-primary" />
                  </button>

                  <button
                    type="button"
                    onClick={() => selectMode('dev')}
                    className="group flex w-full items-center gap-4 rounded-lg border border-white/10 bg-black/50 px-5 py-4 text-left transition-colors duration-200 hover:border-primary/50 hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Terminal className="h-5 w-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-white">Acceso Dev</span>
                      <span className="block text-xs text-zinc-500">Dashboard interno del equipo</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors duration-200 group-hover:text-primary" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <button
                  type="button"
                  onClick={() => selectMode('picker')}
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Volver
                </button>

                <h1 className="mt-4 text-center font-logo text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-left">
                  Acceso
                </h1>
                <p className="mt-2 text-center text-sm text-zinc-400 md:text-left">
                  {mode === 'cliente' ? 'Portal seguro para clientes' : 'Acceso para el equipo interno'}
                </p>

                <form onSubmit={handleSubmit} className="mt-10 space-y-5">
                  {/* Honeypot — hidden from humans (incl. screen readers), tempting for naive bots. */}
                  <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                    <label htmlFor="login-company-hp">No completar este campo.</label>
                    <input
                      id="login-company-hp"
                      type="text"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                    />
                  </div>

                  <div className="group relative">
                    <Label htmlFor="email" className="sr-only">Correo electrónico</Label>
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 transition-colors duration-200 group-focus-within:text-primary" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="Correo electrónico"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                      disabled={isLoading}
                      className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white ring-offset-0 transition-colors duration-200 placeholder:text-zinc-500 placeholder:transition-colors placeholder:duration-200 hover:bg-black/60 focus-visible:border-primary focus-visible:bg-black/60 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:shadow-[0_0_0_4px_rgba(33,150,243,0.08)]"
                    />
                  </div>

                  <div className="group relative">
                    <Label htmlFor="password" className="sr-only">Contraseña</Label>
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 transition-colors duration-200 group-focus-within:text-primary" />
                    <Input
                      ref={passwordRef}
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Contraseña"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white ring-offset-0 transition-colors duration-200 placeholder:text-zinc-500 placeholder:transition-colors placeholder:duration-200 hover:bg-black/60 focus-visible:border-primary focus-visible:bg-black/60 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:shadow-[0_0_0_4px_rgba(33,150,243,0.08)]"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        role="alert"
                        aria-live="polite"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="text-center text-sm text-red-400"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="h-14 w-full text-base font-semibold transition-all duration-300 hover:scale-[1.01] disabled:scale-100"
                    >
                      {isLoading ? <Spinner size="sm" label="Iniciando sesión" /> : 'Acceder'}
                    </Button>
                  </div>
                </form>

                <div className="mt-4 text-center md:text-left">
                  {mode === 'dev' ? (
                    forgotOpen ? (
                      <form onSubmit={handleForgotSubmit} className="space-y-2">
                        {forgotMessage ? (
                          <p className="text-xs leading-relaxed text-zinc-400">{forgotMessage}</p>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              required
                              autoFocus
                              placeholder="Tu correo"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              disabled={forgotSubmitting}
                              className="h-9 flex-1 rounded-md border-white/10 bg-black/50 text-xs text-white placeholder:text-zinc-500"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={forgotSubmitting}
                              className="h-9 shrink-0 text-xs"
                            >
                              {forgotSubmitting ? <Spinner size="sm" /> : 'Enviar'}
                            </Button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setForgotOpen(false);
                            setForgotMessage(null);
                          }}
                          className="text-xs text-zinc-600 transition-colors hover:text-zinc-400"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setForgotOpen(true)}
                        className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )
                  ) : (
                    <ObfuscatedMailto
                      email={TEAM_EMAIL}
                      subject="Recuperar acceso"
                      className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      ¿Olvidaste tu contraseña?
                    </ObfuscatedMailto>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.5 }}
            className="mt-8 text-center md:text-left"
          >
            <p className="font-mono text-[11px] text-zinc-700">
              v1.0.0 · PixelTEC OS · &copy; {new Date().getFullYear()}
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
