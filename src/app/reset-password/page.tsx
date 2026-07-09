'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { resetPasswordAction } from '@/app/actions';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const res = await resetPasswordAction(token, password);
    setLoading(false);

    if (res.ok) {
      setDone(true);
    } else {
      setError(res.message);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-zinc-400 mb-6">Este enlace no es válido o está incompleto.</p>
        <Link href="/login?modo=dev" className="text-sm text-cyan-400 hover:underline">
          Volver al login
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="mb-2 font-semibold text-white">Contraseña actualizada</p>
        <p className="mb-6 text-sm text-zinc-400">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <Link href="/login?modo=dev" className="text-sm text-cyan-400 hover:underline">
          Ir a login →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="group relative">
        <Label htmlFor="password" className="sr-only">Nueva contraseña</Label>
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
        />
      </div>
      <div className="group relative">
        <Label htmlFor="confirm" className="sr-only">Confirmar contraseña</Label>
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirmar contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
        />
      </div>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading} className="h-14 w-full text-base font-semibold">
        {loading ? <Spinner size="sm" label="Guardando" /> : 'Restablecer contraseña'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src={process.env.NEXT_PUBLIC_LOGO_URL!}
            alt="PixelTEC"
            width={48}
            height={48}
            className="h-12 w-12"
          />
        </div>
        <h1 className="mb-2 text-center font-logo text-3xl font-extrabold tracking-tight text-white">
          Nueva contraseña
        </h1>
        <p className="mb-10 text-center text-sm text-zinc-400">
          Elige una contraseña nueva para tu cuenta.
        </p>
        <Suspense fallback={<div className="flex justify-center"><Spinner /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
