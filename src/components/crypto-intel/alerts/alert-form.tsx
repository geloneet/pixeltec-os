"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAlertSchema } from "@/lib/crypto-intel/schemas/alert";
import type { CreateAlertInput } from "@/lib/crypto-intel/schemas/alert";
import { WATCHLIST } from "@/lib/crypto-intel/watchlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AlertFormProps {
  defaultValues?: Partial<CreateAlertInput>;
  onSubmit: (data: CreateAlertInput) => Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
}

const TYPE_LABELS: Record<CreateAlertInput["type"], string> = {
  price_above: "Supere precio",
  price_below: "Baje de precio",
  change_percent: "Cambio porcentual",
};

export function AlertForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  submitLabel = "Crear alerta",
}: AlertFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAlertInput>({
    resolver: zodResolver(CreateAlertSchema),
    defaultValues: {
      symbol: defaultValues?.symbol ?? "",
      type: defaultValues?.type ?? "price_above",
      threshold: defaultValues?.threshold ?? undefined,
      pctWindow: defaultValues?.pctWindow ?? "24h",
      pctDirection: defaultValues?.pctDirection ?? "down",
      channels: defaultValues?.channels ?? ["dashboard"],
      telegramChatId: defaultValues?.telegramChatId ?? "",
      cooldownMinutes: defaultValues?.cooldownMinutes ?? 60,
      displayName: defaultValues?.displayName ?? "",
    },
  });

  const watchType = watch("type");
  const watchSymbol = watch("symbol");
  const watchThreshold = watch("threshold");
  const watchChannels = watch("channels") ?? [];
  const watchCooldown = watch("cooldownMinutes");
  const watchPctWindow = watch("pctWindow");
  const watchPctDirection = watch("pctDirection");
  const hasTelegram = watchChannels.includes("telegram");
  const isChangePct = watchType === "change_percent";

  function toggleChannel(channel: "telegram" | "dashboard") {
    const current = watchChannels;
    const next = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    setValue("channels", next as Array<"telegram" | "dashboard">);
  }

  // Live preview
  function buildPreview(): string {
    if (!watchSymbol || !watchThreshold) return "Completa los campos para ver la vista previa.";
    if (isChangePct) {
      return `Recibirás notificación cuando ${watchSymbol} cambie ${watchPctDirection === "down" ? "baje" : "suba"} ${watchThreshold}% en ${watchPctWindow ?? "24h"}. Cooldown: ${watchCooldown ?? 60} min.`;
    }
    const action = watchType === "price_above" ? "supere" : "baje de";
    return `Recibirás notificación cuando ${watchSymbol} ${action} $${Number(watchThreshold).toLocaleString()}. Cooldown: ${watchCooldown ?? 60} min.`;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Symbol */}
      <div className="space-y-1.5">
        <Label className="text-sm text-zinc-300">Asset</Label>
        <Select
          value={watch("symbol")}
          onValueChange={(v) => setValue("symbol", v)}
        >
          <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
            <SelectValue placeholder="Selecciona un asset" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-zinc-900 text-white">
            {WATCHLIST.map((w) => (
              <SelectItem key={w.symbol} value={w.symbol}>
                {w.symbol} — {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.symbol && (
          <p className="text-xs text-red-400">{errors.symbol.message}</p>
        )}
      </div>

      {/* Condition type */}
      <div className="space-y-1.5">
        <Label className="text-sm text-zinc-300">Condición</Label>
        <Select
          value={watchType}
          onValueChange={(v) => setValue("type", v as CreateAlertInput["type"])}
        >
          <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-zinc-900 text-white">
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-xs text-red-400">{errors.type.message}</p>
        )}
      </div>

      {/* Threshold */}
      <div className="space-y-1.5">
        <Label className="text-sm text-zinc-300">
          {isChangePct ? "Umbral (%)" : "Precio USD"}
        </Label>
        <Input
          type="number"
          step="any"
          placeholder={isChangePct ? "ej. 5" : "ej. 50000"}
          className="border-white/10 bg-white/[0.04] text-white placeholder:text-zinc-600"
          {...register("threshold", { valueAsNumber: true })}
        />
        {errors.threshold && (
          <p className="text-xs text-red-400">{errors.threshold.message}</p>
        )}
      </div>

      {/* change_percent extras */}
      {isChangePct && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm text-zinc-300">Ventana</Label>
            <Select
              value={watchPctWindow ?? "24h"}
              onValueChange={(v) =>
                setValue("pctWindow", v as CreateAlertInput["pctWindow"])
              }
            >
              <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-900 text-white">
                <SelectItem value="1h">1 hora</SelectItem>
                <SelectItem value="24h">24 horas</SelectItem>
                <SelectItem value="7d">7 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-zinc-300">Dirección</Label>
            <Select
              value={watchPctDirection ?? "down"}
              onValueChange={(v) =>
                setValue("pctDirection", v as CreateAlertInput["pctDirection"])
              }
            >
              <SelectTrigger className="border-white/10 bg-white/[0.04] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-zinc-900 text-white">
                <SelectItem value="up">Sube</SelectItem>
                <SelectItem value="down">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Channels */}
      <div className="space-y-2">
        <Label className="text-sm text-zinc-300">Canales</Label>
        <div className="flex gap-4">
          {(["telegram", "dashboard"] as const).map((ch) => (
            <label
              key={ch}
              className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300"
            >
              <Checkbox
                checked={watchChannels.includes(ch)}
                onCheckedChange={() => toggleChannel(ch)}
                className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
              {ch === "telegram" ? "Telegram" : "Dashboard"}
            </label>
          ))}
        </div>
        {errors.channels && (
          <p className="text-xs text-red-400">{errors.channels.message}</p>
        )}
      </div>

      {/* Telegram Chat ID — only when telegram selected */}
      {hasTelegram && (
        <div className="space-y-1.5">
          <Label className="text-sm text-zinc-300">
            Telegram Chat ID{" "}
            <span className="text-zinc-500">(opcional — si distinto al tuyo)</span>
          </Label>
          <Input
            placeholder="ej. 123456789"
            className="border-white/10 bg-white/[0.04] text-white placeholder:text-zinc-600"
            {...register("telegramChatId")}
          />
        </div>
      )}

      {/* Cooldown */}
      <div className="space-y-1.5">
        <Label className="text-sm text-zinc-300">Cooldown (minutos)</Label>
        <Input
          type="number"
          min={5}
          max={1440}
          className="border-white/10 bg-white/[0.04] text-white"
          {...register("cooldownMinutes", { valueAsNumber: true })}
        />
        {errors.cooldownMinutes && (
          <p className="text-xs text-red-400">{errors.cooldownMinutes.message}</p>
        )}
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <Label className="text-sm text-zinc-300">
          Nombre <span className="text-zinc-500">(opcional)</span>
        </Label>
        <Input
          placeholder="ej. BTC nivel soporte"
          className="border-white/10 bg-white/[0.04] text-white placeholder:text-zinc-600"
          {...register("displayName")}
        />
      </div>

      {/* Live preview */}
      <div
        className={cn(
          "rounded-xl border p-4 font-mono text-xs leading-relaxed",
          "border-white/[0.06] bg-white/[0.02] text-zinc-400"
        )}
      >
        {buildPreview()}
      </div>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
      >
        {isLoading ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
