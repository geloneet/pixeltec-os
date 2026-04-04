'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Mail, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, signOut, type AuthError } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useUserProfile } from '@/firebase/auth/use-user-profile';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const user = useUser();
  const { userProfile, loading: profileLoading } = useUserProfile();

  // Redirect if user is already logged in and profile is loaded.
  // Skip during active login to avoid racing with session cookie creation.
  useEffect(() => {
    if (isLoading || isRedirecting || profileLoading) return;

    if (userProfile) {
        if (userProfile.role === 'admin' || userProfile.role === 'editor') {
            router.push('/dashboard');
        } else if (userProfile.role === 'client') {
            router.push('/portal');
        }
    }
  }, [userProfile, profileLoading, isLoading, isRedirecting, router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading || !auth || !firestore) return;

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

            if (userData.role === 'admin' || userData.role === 'editor') {
                redirectTo = '/dashboard';
            } else if (userData.role === 'client') {
                redirectTo = '/portal';
            }

            if (redirectTo) {
                // Set server-side session cookie before redirecting
                const idToken = await user.getIdToken();
                const sessionRes = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken }),
                });

                if (!sessionRes.ok) {
                    await signOut(auth);
                    setError('Error al crear la sesión. Por favor, intenta de nuevo.');
                    return;
                }

                setIsRedirecting(true);
                router.push(redirectTo);
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
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030303] text-white p-4">
            <LoaderCircle className="h-12 w-12 animate-spin text-cyan-400" />
        </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#030303] text-white p-4">
      {/* Background Blobs */}
      <div className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-cyan-500/10 blur-[120px] animate-pulse-subtle" />
      <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-blue-500/10 blur-[120px] animate-pulse-subtle animation-delay-3000" />
      
      <motion.div 
        initial={{ opacity: 0, y: -20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/30 p-8 backdrop-blur-lg shadow-2xl shadow-black/40"
      >
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt="PixelTEC Logo"
            width={50}
            height={50}
            className="mb-4"
          />
          <h1 className="font-logo text-5xl font-extrabold uppercase tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            PixelTEC
          </h1>
          <p className="mt-2 text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">
            System OS // Authentication
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <Label htmlFor="email" className="sr-only">Correo Electrónico</Label>
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Correo Electrónico"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500"
            />
          </div>
          <div className="relative">
            <Label htmlFor="password" className="sr-only">Contraseña</Label>
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Contraseña"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500"
            />
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

      <p className="absolute bottom-6 text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} PixelTEC OS. Access Restricted.
      </p>
    </main>
  );
}
