'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { changePasswordAction } from '@/lib/auth/actions';

export function SecuritySettings() {
  const user = useUser();

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

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
    if (!user) {
      setPwError('No se pudo verificar tu sesión. Recarga la página.');
      return;
    }

    setPwLoading(true);
    try {
      const result = await changePasswordAction(currentPw, newPw);
      if (result.ok) {
        setPwSuccess('Contraseña actualizada correctamente.');
        setCurrentPw('');
        setNewPw('');
      } else if (result.error === 'wrong-password') {
        setPwError('La contraseña actual es incorrecta.');
      } else if (result.error === 'too-short') {
        setPwError('La nueva contraseña debe tener al menos 8 caracteres.');
      } else if (result.error === 'no-session') {
        setPwError('No se pudo verificar tu sesión. Recarga la página.');
      } else {
        setPwError('Error al cambiar la contraseña. Inténtalo de nuevo.');
      }
    } catch {
      setPwError('Error al cambiar la contraseña. Inténtalo de nuevo.');
    } finally {
      setPwLoading(false);
    }
  };

  // C-PR1: la tarjeta de «Cerrar sesión» se eliminó de esta pantalla — el
  // logout vive únicamente en el menú del avatar (src/components/nav/user-menu.tsx).

  return (
    <div className="space-y-8">
      {/* Change password */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">
          Cambiar contraseña
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label
              htmlFor="current-password"
              className="mb-1 block text-xs text-muted-foreground"
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
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-0 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="mb-1 block text-xs text-muted-foreground"
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
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-0 disabled:opacity-50"
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
            className="rounded-lg bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pwLoading ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
