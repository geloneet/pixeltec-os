'use client';

import { memo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Mail, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, signOut, type AuthError } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useUserProfile } from '@/firebase/auth/use-user-profile';

// Decorative background — memoized so the grid + glow never repaint when
// the form's state changes (every keystroke would otherwise trigger a
// React reconcile pass on this subtree).
const LoginBackdrop = memo(function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Layer 2 — technical grid, masked to the top-left quadrant */}
      <svg
        className="absolute inset-0 h-full w-full opacity-70 sm:opacity-100"
        style={{
          WebkitMaskImage:
            'radial-gradient(ellipse at top left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 35%, transparent 70%)',
          maskImage:
            'radial-gradient(ellipse at top left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 35%, transparent 70%)',
        }}
      >
        <defs>
          <pattern id="login-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(34,211,238,0.05)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>

      {/* Layer 3 — cyan corner glow */}
      <div
        className="absolute -left-32 -top-32 h-[600px] w-[600px] opacity-60 sm:opacity-100"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
});

// Terminal-style blinking cursor for the subtitle. Memoized so the framer
// animation isn't restarted on every parent render.
const BlinkingCursor = memo(function BlinkingCursor() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-1 inline-block text-cyan-400"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      ▊
    </motion.span>
  );
});

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const auth = useAuth();
  const firestore = useFirestore();
  const user = useUser();
  const { userProfile, loading: profileLoading } = useUserProfile();

  // Redirect if user is already logged in and profile is loaded.
  // Skip during active login to avoid racing with session cookie creation.
  // IMPORTANT: must create the __session cookie before redirecting — middleware
  // requires it on every protected route. Without this, Firebase-authenticated
  // users enter an infinite /login ↔ /hoy redirect loop.
  useEffect(() => {
    if (isLoading || isRedirecting || profileLoading || !userProfile || !user) return;

    let target: string | null = null;
    if (redirectParam) {
        target = redirectParam;
    } else if (userProfile.role === 'admin' || userProfile.role === 'editor') {
        target = '/hoy';
    } else if (userProfile.role === 'client') {
        target = '/portal';
    }

    if (!target) return;

    setIsRedirecting(true);

    (async () => {
      try {
        const idToken = await user.getIdToken();
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, rememberMe: false }),
        });
        if (!sessionRes.ok) {
          await signOut(auth);
          setError('Error al restaurar la sesión. Por favor, inicia sesión de nuevo.');
          setIsRedirecting(false);
          return;
        }
        window.location.assign(target!);
      } catch {
        setIsRedirecting(false);
      }
    })();
  }, [userProfile, profileLoading, isLoading, isRedirecting, redirectParam, user, auth]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || !auth || !firestore) return;

    // Honeypot — silent no-op: looks like the form is processing,
    // but Firebase and the session API are never called.
    if (honeypot.trim() !== '') {
      setIsLoading(true);
      await new Promise((r) => setTimeout(r, 500));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            let redirectTo: string | null = null;

            if (redirectParam) {
                redirectTo = redirectParam;
            } else if (userData.role === 'admin' || userData.role === 'editor') {
                redirectTo = '/hoy';
            } else if (userData.role === 'client') {
                redirectTo = '/portal';
            }

            if (redirectTo) {
                // Set server-side session cookie before redirecting
                const idToken = await user.getIdToken();
                const sessionRes = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken, rememberMe }),
                });

                if (!sessionRes.ok) {
                    await signOut(auth);
                    setError('Error al crear la sesión. Por favor, intenta de nuevo.');
                    return;
                }

                setIsRedirecting(true);
                window.location.assign(redirectTo);
            } else {
                await signOut(auth);
                setError('Tu rol no está definido. Contacta al administrador.');
            }
        } else {
            // Security measure: if a user is authenticated but has no profile in Firestore,
            // they shouldn't be able to access anything.
            await signOut(auth);
            setError('Tu cuenta no está configurada en el sistema. Contacta al administrador.');
        }
      }
    } catch (err) {
      const error = err as AuthError;
      let friendlyMessage = 'Ocurrió un error inesperado. Por favor, intenta de nuevo.';
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          friendlyMessage = 'El correo electrónico o la contraseña son incorrectos.';
          break;
        case 'auth/invalid-email':
          friendlyMessage = 'El formato del correo electrónico no es válido.';
          break;
        case 'auth/too-many-requests':
          friendlyMessage = 'Acceso bloqueado temporalmente por demasiados intentos. Intenta más tarde.';
          break;
        case 'auth/network-request-failed':
            friendlyMessage = 'Error de red. Por favor, revisa tu conexión a internet.';
            break;
      }
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show a loading screen while user state is being determined
  if (user === undefined || (user && profileLoading)) {
    return (
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 text-white p-4">
            <LoaderCircle className="h-12 w-12 animate-spin text-cyan-400" />
        </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 text-white p-4">
      <LoginBackdrop />

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-8 backdrop-blur-lg sm:p-10 shadow-[0_0_40px_-12px_rgba(34,211,238,0.15),0_20px_60px_-15px_rgba(0,0,0,0.7)]"
      >
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          >
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_URL!}
              alt="PixelTEC Logo"
              width={50}
              height={50}
              className="mb-4 h-12 w-12 sm:h-[50px] sm:w-[50px]"
            />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
            className="font-logo text-5xl font-extrabold uppercase tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
          >
            PixelTEC
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.35 }}
            className="mt-2 font-mono text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-zinc-400"
          >
            <span>System OS</span>
            <span className="mx-2 text-cyan-400">//</span>
            <span>Authentication</span>
            <BlinkingCursor />
          </motion.p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">
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

          {/* Status line — system feel */}
          <div
            aria-hidden="true"
            className="hidden sm:flex items-center gap-2 -mt-2 mb-2 text-[11px] font-mono uppercase tracking-[0.15em] text-zinc-500"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
            </span>
            <span>Secure channel established</span>
          </div>

          <div className="group relative">
            <Label htmlFor="email" className="sr-only">Correo Electrónico</Label>
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 transition-colors duration-200 group-focus-within:text-cyan-400" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Correo Electrónico"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500 transition-colors duration-200 hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500"
            />
          </div>
          <div className="group relative">
            <Label htmlFor="password" className="sr-only">Contraseña</Label>
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 transition-colors duration-200 group-focus-within:text-cyan-400" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500 transition-colors duration-200 hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500"
            />
          </div>

          {/* Remember session checkbox */}
          <div className="flex items-center gap-2 mt-2 mb-4">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              disabled={isLoading}
              className="border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 data-[state=checked]:text-zinc-950"
            />
            <Label
              htmlFor="remember-me"
              className="text-xs text-zinc-400 cursor-pointer select-none"
            >
              Mantener sesión iniciada
            </Label>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <div className="pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="h-14 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-base font-bold text-white shadow-lg shadow-cyan-500/10 transition-all duration-300 hover:from-cyan-400 hover:to-blue-400 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
            >
              {isLoading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </div>
        </form>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 font-mono text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <span>v1.0.0</span>
          <span className="text-zinc-700">·</span>
          <span>PixelTEC OS</span>
          <span className="text-zinc-700">·</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
        <div className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-zinc-700">
          Restricted Access
        </div>
      </div>
    </main>
  );
}
