"use client";

import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  label: string;
  onApprove: () => void;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * Barra de aprobación de la estación activa. Aprobar SELLA el documento (se
 * congela con fecha y autor). Se puede reabrir después, dejando rastro.
 */
export function ApproveBar({ label, onApprove, disabled, busy }: Props) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled || busy}
        className="flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-cyan-400 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {label}
      </button>
      <span className="text-[11px] text-zinc-600">
        Al aprobar se sella el documento. Podrás reabrirlo, pero quedará registrado.
      </span>
    </div>
  );
}
