'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Check, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/hooks/use-user';
import { changePasswordAction, revokeOtherSessionsAction } from '@/lib/auth/actions';

/** Mensajes por código de error de `changePasswordAction` (C-PR2). */
const PW_ERROR_MESSAGES: Record<string, string> = {
  'wrong-password': 'La contraseña actual es incorrecta.',
  'too-short': 'La nueva contraseña debe tener al menos 8 caracteres.',
  weak: 'La nueva contraseña debe incluir al menos una letra y un número.',
  mismatch: 'La confirmación no coincide con la nueva contraseña.',
  'rate-limited': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'no-session': 'No se pudo verificar tu sesión. Recarga la página.',
  unknown: 'Error al cambiar la contraseña. Inténtalo de nuevo.',
};

/** Mensajes por código de error de `revokeOtherSessionsAction` (C-PR3). */
const REVOKE_ERROR_MESSAGES: Record<string, string> = {
  'no-session': 'No se pudo verificar tu sesión. Recarga la página.',
  'no-sid':
    'Tu sesión actual es anterior a esta función. Cierra sesión y vuelve a entrar para poder usarla.',
  unknown: 'No se pudieron cerrar las otras sesiones. Inténtalo de nuevo.',
};

/**
 * Parseo GRUESO del user-agent propio (C-PR3): suficiente para que el usuario
 * reconozca «este dispositivo» — no pretende ser una librería de detección.
 */
function parseOwnUserAgent(ua: string): { browser: string; os: string } {
  let browser = 'Navegador';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\//i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'este dispositivo';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { browser, os };
}

type Strength = 'debil' | 'aceptable' | 'fuerte';

/**
 * Heurística propia (sin zxcvbn): longitud + clases de caracteres.
 * - fuerte: ≥12 caracteres y ≥3 clases (minúscula/mayúscula/número/símbolo)
 * - aceptable: cumple el mínimo del servidor (≥8, letra y número)
 * - débil: todo lo demás
 */
function estimateStrength(pw: string): Strength {
  const classes =
    Number(/[a-z]/.test(pw)) +
    Number(/[A-Z]/.test(pw)) +
    Number(/[0-9]/.test(pw)) +
    Number(/[^a-zA-Z0-9]/.test(pw));
  if (pw.length >= 12 && classes >= 3) return 'fuerte';
  if (pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)) return 'aceptable';
  return 'debil';
}

const STRENGTH_META: Record<Strength, { label: string; bar: string; text: string; width: string }> = {
  debil: { label: 'Débil', bar: 'bg-red-400', text: 'text-red-400', width: 'w-1/3' },
  aceptable: { label: 'Aceptable', bar: 'bg-amber-400', text: 'text-amber-400', width: 'w-2/3' },
  fuerte: { label: 'Fuerte', bar: 'bg-emerald-400', text: 'text-emerald-400', width: 'w-full' },
};

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

function PasswordField({ id, label, autoComplete, value, onChange, disabled }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 pr-10 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-0 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        met ? 'text-emerald-400' : 'text-muted-foreground'
      }`}
    >
      <Check className={`h-3 w-3 ${met ? 'opacity-100' : 'opacity-40'}`} />
      {children}
    </li>
  );
}

export function SecuritySettings() {
  const user = useUser();

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  // C-PR3: revocación de otras sesiones
  const [revokeAfterChange, setRevokeAfterChange] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  // El user-agent solo existe en el cliente — leerlo en un effect evita
  // divergencia de hidratación (el server renderiza el placeholder genérico).
  const [ownAgent, setOwnAgent] = useState<{ browser: string; os: string } | null>(null);
  useEffect(() => {
    setOwnAgent(parseOwnUserAgent(navigator.userAgent));
  }, []);

  const handleRevokeOthers = async () => {
    setRevoking(true);
    try {
      const result = await revokeOtherSessionsAction();
      if (result.ok) {
        toast.success(
          result.revoked === 0
            ? 'No había otras sesiones activas.'
            : `Se ${result.revoked === 1 ? 'cerró 1 sesión' : `cerraron ${result.revoked} sesiones`} en otros dispositivos.`
        );
      } else {
        toast.error(REVOKE_ERROR_MESSAGES[result.error] ?? REVOKE_ERROR_MESSAGES['unknown']);
      }
    } catch {
      toast.error(REVOKE_ERROR_MESSAGES['unknown']);
    } finally {
      setRevoking(false);
      setConfirmRevoke(false);
    }
  };

  const hasMinLength = newPw.length >= 8;
  const hasLetterAndNumber = /[a-zA-Z]/.test(newPw) && /[0-9]/.test(newPw);
  const strength = useMemo(() => estimateStrength(newPw), [newPw]);
  const strengthMeta = STRENGTH_META[strength];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (!currentPw || !newPw || !confirmPw) {
      setPwError('Completa los tres campos.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(PW_ERROR_MESSAGES['mismatch']);
      return;
    }
    if (!hasMinLength) {
      setPwError(PW_ERROR_MESSAGES['too-short']);
      return;
    }
    if (!hasLetterAndNumber) {
      setPwError(PW_ERROR_MESSAGES['weak']);
      return;
    }
    if (!user) {
      setPwError(PW_ERROR_MESSAGES['no-session']);
      return;
    }

    setPwLoading(true);
    try {
      const result = await changePasswordAction(currentPw, newPw, confirmPw);
      if (result.ok) {
        toast.success('Contraseña actualizada correctamente.');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
        // C-PR3: si el usuario marcó la casilla, cierra las demás sesiones
        // DESPUÉS del cambio exitoso. Un fallo aquí no revierte nada: la
        // contraseña ya cambió y el toast de error lo deja claro.
        if (revokeAfterChange) {
          await handleRevokeOthers();
        }
      } else {
        setPwError(PW_ERROR_MESSAGES[result.error] ?? PW_ERROR_MESSAGES['unknown']);
      }
    } catch {
      setPwError(PW_ERROR_MESSAGES['unknown']);
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
          <PasswordField
            id="current-password"
            label="Contraseña actual"
            autoComplete="current-password"
            value={currentPw}
            onChange={setCurrentPw}
            disabled={pwLoading}
          />
          <PasswordField
            id="new-password"
            label="Nueva contraseña"
            autoComplete="new-password"
            value={newPw}
            onChange={setNewPw}
            disabled={pwLoading}
          />

          {/* Requisitos en vivo + fortaleza */}
          <div className="space-y-2">
            <ul className="space-y-1">
              <Requirement met={hasMinLength}>Mínimo 8 caracteres</Requirement>
              <Requirement met={hasLetterAndNumber}>Al menos una letra y un número</Requirement>
            </ul>
            {newPw.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${strengthMeta.bar} ${strengthMeta.width}`}
                  />
                </div>
                <span className={`text-xs ${strengthMeta.text}`}>{strengthMeta.label}</span>
              </div>
            )}
          </div>

          <PasswordField
            id="confirm-password"
            label="Confirmar nueva contraseña"
            autoComplete="new-password"
            value={confirmPw}
            onChange={setConfirmPw}
            disabled={pwLoading}
          />
          {confirmPw.length > 0 && newPw !== confirmPw && (
            <p className="text-xs text-amber-400">Las contraseñas no coinciden todavía.</p>
          )}

          {/* C-PR3: revocación de otras sesiones tras el cambio */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={revokeAfterChange}
              onChange={(e) => setRevokeAfterChange(e.target.checked)}
              disabled={pwLoading}
              className="h-3.5 w-3.5 rounded border-border bg-secondary accent-primary"
            />
            <span className="text-xs text-muted-foreground">
              Cerrar mis otras sesiones después del cambio
            </span>
          </label>

          {pwError && (
            <p className="text-xs text-red-400">{pwError}</p>
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

      {/* C-PR3: sesiones activas + revocación de las demás */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-foreground">Sesiones activas</h3>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <MonitorSmartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm text-foreground">
                {ownAgent ? `${ownAgent.browser} en ${ownAgent.os}` : 'Este dispositivo'}
              </p>
              <p className="text-xs text-muted-foreground">Sesión actual · ahora</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
            Activa
          </span>
        </div>

        <div className="mt-3">
          {confirmRevoke ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground">
                Se cerrará tu sesión en todos los demás dispositivos. ¿Continuar?
              </p>
              <button
                type="button"
                onClick={handleRevokeOthers}
                disabled={revoking}
                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revoking ? 'Cerrando…' : 'Sí, cerrar las demás'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevoke(false)}
                disabled={revoking}
                className="text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRevoke(true)}
              disabled={revoking}
              className="rounded-lg bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium transition hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cerrar las demás sesiones
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
