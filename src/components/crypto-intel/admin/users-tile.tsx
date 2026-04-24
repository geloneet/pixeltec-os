"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AddTelegramUserSchema } from "@/lib/crypto-intel/schemas/user";
import type { AddTelegramUserInput } from "@/lib/crypto-intel/schemas/user";
import { addAuthorizedUser, deauthorizeUser } from "@/lib/crypto-intel/actions/users";
import type { TelegramUserSerialized } from "@/lib/crypto-intel/queries/users";

interface UsersTileProps {
  users: TelegramUserSerialized[];
}

export function UsersTile({ users: initialUsers }: UsersTileProps) {
  const [users, setUsers] = useState(initialUsers);
  const [addOpen, setAddOpen] = useState(false);
  const [deauthTarget, setDeauthTarget] = useState<TelegramUserSerialized | null>(null);
  const [deauthOpen, setDeauthOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeauthing, setIsDeauthing] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AddTelegramUserInput>({
    resolver: zodResolver(AddTelegramUserSchema),
    defaultValues: { role: "operator" },
  });

  async function onAdd(data: AddTelegramUserInput) {
    setIsSubmitting(true);
    try {
      const result = await addAuthorizedUser(data);
      if (result.ok) {
        toast.success("Usuario autorizado");
        setAddOpen(false);
        reset();
        // Optimistic: reload page to get updated list
        window.location.reload();
      } else {
        toast.error(result.error ?? "Error al autorizar");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDeauth() {
    if (!deauthTarget) return;
    setIsDeauthing(true);
    try {
      const result = await deauthorizeUser(deauthTarget.docId);
      if (result.ok) {
        toast.success("Usuario desautorizado");
        setUsers((prev) => prev.filter((u) => u.docId !== deauthTarget.docId));
        setDeauthOpen(false);
        setDeauthTarget(null);
      } else {
        toast.error(result.error ?? "Error al desautorizar");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setIsDeauthing(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
              Telegram
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Usuarios autorizados
            </h2>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Autorizar
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10">
            <p className="text-sm text-zinc-500">Sin usuarios autorizados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.docId}
                className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-white">
                    {user.firstName ?? `ID ${user.telegramUserId}`}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {user.telegramUserId}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      user.role === "owner"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] px-1.5 py-0"
                        : "border-white/10 text-zinc-400 text-[10px] px-1.5 py-0"
                    }
                  >
                    {user.role}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-zinc-400 hover:text-red-400"
                    onClick={() => {
                      setDeauthTarget(user);
                      setDeauthOpen(true);
                    }}
                  >
                    Desautorizar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="border-white/[0.06] bg-zinc-950 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Autorizar usuario de Telegram</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAdd)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-300">Telegram ID</Label>
              <Input
                placeholder="ej. 123456789"
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-zinc-600"
                {...register("telegramId")}
              />
              {errors.telegramId && (
                <p className="text-xs text-red-400">{errors.telegramId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-300">Nombre (opcional)</Label>
              <Input
                placeholder="ej. Juan"
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-zinc-600"
                {...register("firstName")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-300">Rol</Label>
              <Select
                value={watch("role")}
                onValueChange={(v) => setValue("role", v as "owner" | "operator")}
              >
                <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-zinc-900 text-white">
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddOpen(false)}
                disabled={isSubmitting}
                className="text-zinc-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {isSubmitting ? "Autorizando..." : "Autorizar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deauth confirm dialog */}
      <AlertDialog open={deauthOpen} onOpenChange={setDeauthOpen}>
        <AlertDialogContent className="border-white/[0.06] bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Desautorizar usuario?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              El usuario{" "}
              <span className="font-medium text-zinc-200">
                {deauthTarget?.firstName ?? deauthTarget?.telegramUserId}
              </span>{" "}
              ya no podrá usar el bot de Telegram.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeauthing}
              className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeauth}
              disabled={isDeauthing}
              className="bg-red-700 text-white hover:bg-red-600"
            >
              {isDeauthing ? "Desautorizando..." : "Desautorizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
