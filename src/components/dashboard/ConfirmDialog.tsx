'use client';

/**
 * ConfirmDialog — reusable destructive-action confirmation dialog.
 * Replaces all window.confirm() calls across the dashboard.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   const [pendingId, setPendingId] = useState<string | null>(null);
 *
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Eliminar tarea"
 *     description="Esta acción no se puede deshacer."
 *     onConfirm={() => handleDelete(pendingId!)}
 *   />
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => Promise<void> | void;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const actionClass =
    variant === 'destructive'
      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-full px-5 py-2 text-sm font-semibold transition-colors'
      : 'bg-white text-black hover:bg-zinc-100 rounded-full px-5 py-2 text-sm font-semibold transition-colors';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-900 border border-white/10 rounded-[1.5rem] shadow-2xl max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-semibold">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400 text-sm mt-1">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-2">
          <AlertDialogCancel
            disabled={loading}
            className="bg-transparent border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white rounded-full px-5 py-2 text-sm transition-colors"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            className={actionClass}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
