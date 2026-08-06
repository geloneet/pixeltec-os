'use client';

import { useState } from 'react';
import { Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  confirmMfaEnrollment,
  disableMfa,
  startMfaEnrollment,
} from '@/lib/mfa/actions';

/** Mensajes por código de error de las actions MFA (C-PR4). */
const MFA_ERROR_MESSAGES: Record<string, string> = {
  'no-session': 'No se pudo verificar tu sesión. Recarga la página.',
  'already-enabled': 'La verificación en dos pasos ya está activa.',
  'no-key':
    'El servidor no tiene configurada la clave de cifrado 2FA (MFA_ENCRYPTION_KEY). Avisa a un administrador.',
  'no-pending': 'No hay un enrolamiento pendiente. Vuelve a empezar.',
  'invalid-code': 'El código no es válido. Inténtalo de nuevo.',
  'wrong-password': 'La contraseña es incorrecta.',
  'not-enabled': 'La verificación en dos pasos no está activa.',
  'rate-limited': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  unknown: 'Ocurrió un error. Inténtalo de nuevo.',
};

type View = 'status' | 'enroll' | 'recovery' | 'disable';

interface MfaSettingsProps {
  /** Estado inicial resuelto en el servidor (perfil/page.tsx). */
  initialEnabled: boolean;
}

export function MfaSettings({ initialEnabled }: MfaSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [view, setView] = useState<View>('status');
  const [busy, setBusy] = useState(false);

  // Enrolamiento
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Desactivación
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const handleStart = async () => {
    setBusy(true);
    try {
      const result = await startMfaEnrollment();
      if (result.ok) {
        setQrDataUrl(result.qrDataUrl);
        setOtpauthUri(result.otpauthUri);
        setConfirmCode('');
        setView('enroll');
      } else {
        toast.error(MFA_ERROR_MESSAGES[result.error] ?? MFA_ERROR_MESSAGES['unknown']);
      }
    } catch {
      toast.error(MFA_ERROR_MESSAGES['unknown']);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmCode.trim()) return;
    setBusy(true);
    try {
      const result = await confirmMfaEnrollment(confirmCode);
      if (result.ok) {
        setRecoveryCodes(result.recoveryCodes);
        setEnabled(true);
        setView('recovery');
        toast.success('Verificación en dos pasos activada.');
      } else {
        toast.error(MFA_ERROR_MESSAGES[result.error] ?? MFA_ERROR_MESSAGES['unknown']);
      }
    } catch {
      toast.error(MFA_ERROR_MESSAGES['unknown']);
    } finally {
      setBusy(false);
    }
  };

  const handleCopyRecovery = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      toast.success('Códigos copiados al portapapeles.');
    } catch {
      toast.error('No se pudieron copiar. Anótalos manualmente.');
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword || !disableCode.trim()) return;
    setBusy(true);
    try {
      const result = await disableMfa(disablePassword, disableCode);
      if (result.ok) {
        setEnabled(false);
        setView('status');
        setDisablePassword('');
        setDisableCode('');
        toast.success('Verificación en dos pasos desactivada.');
      } else {
        toast.error(MFA_ERROR_MESSAGES[result.error] ?? MFA_ERROR_MESSAGES['unknown']);
      }
    } catch {
      toast.error(MFA_ERROR_MESSAGES['unknown']);
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-0 disabled:opacity-50';
  const buttonClass =
    'rounded-lg bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium text-foreground">Verificación en dos pasos</h3>
        {enabled ? (
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
            Activa
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            No configurada
          </span>
        )}
      </div>

      {view === 'status' && !enabled && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Protege tu cuenta con un código de una app de autenticación (Google
            Authenticator, 1Password, etc.) además de tu contraseña.
          </p>
          <button type="button" onClick={handleStart} disabled={busy} className={buttonClass}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {busy ? 'Preparando…' : 'Activar verificación en dos pasos'}
            </span>
          </button>
        </div>
      )}

      {view === 'status' && enabled && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Tu cuenta pide un código de verificación en cada inicio de sesión.
          </p>
          <button
            type="button"
            onClick={() => setView('disable')}
            disabled={busy}
            className={buttonClass}
          >
            <span className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4" />
              Desactivar
            </span>
          </button>
        </div>
      )}

      {view === 'enroll' && (
        <form onSubmit={handleConfirm} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            1. Escanea el código QR con tu app de autenticación.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL local, next/image no aplica
            <img
              src={qrDataUrl}
              alt="Código QR para la app de autenticación"
              width={180}
              height={180}
              className="rounded-lg border border-border bg-white p-2"
            />
          )}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">¿No puedes escanear? Usa el URI manual</summary>
            <code className="mt-1 block break-all rounded bg-secondary p-2 text-[11px]">{otpauthUri}</code>
          </details>
          <p className="text-xs text-muted-foreground">
            2. Ingresa el código de 6 dígitos que muestra la app.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            disabled={busy}
            className={`${inputClass} max-w-[10rem] text-center tracking-[0.3em]`}
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || !confirmCode.trim()} className={buttonClass}>
              {busy ? 'Verificando…' : 'Confirmar y activar'}
            </button>
            <button
              type="button"
              onClick={() => setView('status')}
              disabled={busy}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {view === 'recovery' && (
        <div className="space-y-3">
          <p className="text-xs text-amber-400">
            Guarda estos códigos de recuperación en un lugar seguro. Cada uno
            funciona UNA sola vez si pierdes acceso a tu app de autenticación —
            no volverán a mostrarse.
          </p>
          <div className="grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-secondary/40 p-4 font-mono text-sm text-foreground">
            {recoveryCodes.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleCopyRecovery} className={buttonClass}>
              <span className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copiar
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRecoveryCodes([]);
                setView('status');
              }}
              className={buttonClass}
            >
              Ya los guardé
            </button>
          </div>
        </div>
      )}

      {view === 'disable' && (
        <form onSubmit={handleDisable} className="max-w-sm space-y-3">
          <p className="text-xs text-muted-foreground">
            Para desactivar, confirma tu contraseña y un código vigente (TOTP o
            de recuperación).
          </p>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña actual"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
          <input
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            placeholder="Código de verificación"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            disabled={busy}
            className={inputClass}
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || !disablePassword || !disableCode.trim()}
              className="rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Desactivando…' : 'Desactivar 2FA'}
            </button>
            <button
              type="button"
              onClick={() => setView('status')}
              disabled={busy}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
