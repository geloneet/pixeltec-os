'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { forceRollover } from '@/lib/assistant/actions/rollover';

export function ForceRolloverButton() {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await forceRollover();
      if (result.ok && result.data) {
        toast.success(
          `Rollover completado: ${result.data.archivedCount} tareas archivadas, ${result.data.generatedCount} generadas para próxima semana.`,
        );
      } else {
        toast.error(result.error ?? 'Error en rollover');
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
        >
          {isPending ? 'Ejecutando…' : 'Forzar rollover'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Forzar rollover de la semana actual?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            Esto archivará <strong className="text-zinc-300">todas las tareas</strong> (incluso las pendientes)
            y generará la próxima semana desde tus templates activos.
            Esta acción <strong className="text-red-400">no se puede deshacer</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-zinc-700 text-zinc-300">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleConfirm}
          >
            Forzar rollover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
