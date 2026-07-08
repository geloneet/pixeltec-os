'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Lock, Mail, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginLegacyPortal } from '@/lib/portal/legacy-auth';

export default function LegacyPortalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginLegacyPortal(email, password);
      if (result.ok) {
        window.location.assign('/portal');
        return;
      }
      setError(result.error ?? 'No se pudo iniciar sesión.');
    } catch {
      setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#030303] p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-8 backdrop-blur-lg sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt="PixelTEC Logo"
            width={50}
            height={50}
            className="mb-4 h-12 w-12 sm:h-[50px] sm:w-[50px]"
          />
          <h1 className="font-logo text-3xl font-extrabold uppercase tracking-tighter bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            PixelTEC
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Portal de Cliente</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="group relative">
            <Label htmlFor="email" className="sr-only">Correo Electrónico</Label>
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Correo Electrónico"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
            />
          </div>
          <div className="group relative">
            <Label htmlFor="password" className="sr-only">Contraseña</Label>
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
            />
          </div>

          {error && <p className="text-center text-sm text-red-400">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="h-14 w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-base font-bold text-white disabled:opacity-70"
          >
            {isLoading ? <LoaderCircle className="animate-spin" /> : 'Iniciar Sesión'}
          </Button>
        </form>
      </div>
    </main>
  );
}
