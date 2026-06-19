'use client';

import { useState } from 'react';
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  signOut,
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';

export function SecuritySettings() {
  const auth = useAuth();
  const user = useUser();
  const router = useRouter();

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  // Sign out everywhere state
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess('');
    setPwError('');

    if (!currentPw || !newPw) {
      setPwError('Completa ambos campos.');
      return;
    }
    if (newPw.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!user || !user.email) {
      setPwError('No se pudo verificar tu sesión. Recarga la página.');
      return;
    }

    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setPwSuccess('Contraseña actualizada correctamente.');
      setCurrentPw('');
      setNewPw('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setPwError('La contraseña actual es incorrecta.');
      } else {
        setPwError('Error al cambiar la contraseña. Inténtalo de nuevo.');
      }
    } finally {
      setPwLoading(false);
    }
  };

  const handleRevokeAll = async () => {
    setRevokeError('');
    setRevokeLoading(true);

    try {
      const res = await fetch('/api/auth/revoke', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRevokeError(body.error ?? 'Error al cerrar sesiones.');
        setRevokeLoading(false);
        return;
      }

      // Standard sign-out sequence
      await fetch('/api/auth/session', { method: 'DELETE' });
      if (auth) await signOut(auth);
      router.push('/login');
    } catch {
      setRevokeError('No se pudo completar la operación. Inténtalo de nuevo.');
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Change password */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">
          Cambiar contraseña
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label
              htmlFor="current-password"
              className="mb-1 block text-xs text-zinc-500"
            >
              Contraseña actual
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              disabled={pwLoading}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/20 focus:ring-0 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="mb-1 block text-xs text-zinc-500"
            >
              Nueva contraseña
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              disabled={pwLoading}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-white/20 focus:ring-0 disabled:opacity-50"
            />
          </div>

          {pwError && (
            <p className="text-xs text-red-400">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-xs text-emerald-400">{pwSuccess}</p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pwLoading ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>

      {/* Sign out everywhere */}
      <div>
        <h3 className="mb-1 text-sm font-medium text-zinc-300">
          Cerrar sesión en todos los dispositivos
        </h3>
        <p className="mb-3 text-xs text-zinc-500">
          Cierra tu sesión en todos los navegadores y dispositivos donde estés
          conectado. Tendrás que iniciar sesión de nuevo.
        </p>

        {revokeError && (
          <p className="mb-2 text-xs text-red-400">{revokeError}</p>
        )}

        <button
          type="button"
          onClick={handleRevokeAll}
          disabled={revokeLoading}
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {revokeLoading ? 'Cerrando sesiones…' : 'Cerrar sesión en todos los dispositivos'}
        </button>
      </div>
    </div>
  );
}
