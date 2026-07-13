"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "default" | "danger" | "warning";

export function ActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant = "default",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border bg-background/95 text-foreground backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-poppins">{title}</AlertDialogTitle>
          <AlertDialogDescription className="font-roboto text-muted-foreground">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border bg-card text-foreground hover:bg-secondary hover:text-foreground">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              "font-medium text-white",
              variant === "danger" &&
                "bg-red-600 hover:bg-red-500 focus-visible:ring-red-500",
              variant === "warning" &&
                "bg-amber-600 hover:bg-amber-500 focus-visible:ring-amber-500",
              variant === "default" &&
                "bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-500"
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
