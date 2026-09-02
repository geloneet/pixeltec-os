import { Phone } from "lucide-react";
import type { PhoneNumberInfo } from "@/lib/whatsapp/management-types";
import { SemanticBadge } from "../ui/SemanticBadge";
import { WhatsAppSection } from "../ui/WhatsAppSection";
import { Field } from "./Field";
import { codeVerificationLabel, messagingTierLabel, nameStatusLabel, qualityMeta } from "./meta";

interface PhoneNumberCardProps {
  phone: PhoneNumberInfo;
}

/**
 * Tarjeta del número de WhatsApp Business — la mitad «lectura» del permiso
 * `whatsapp_business_management`.
 *
 * El número en grande arriba no es decoración: es el dato que el revisor de
 * Meta necesita copiar para escribirle desde su propio WhatsApp y grabar el
 * screencast del permiso de mensajería.
 */
export function PhoneNumberCard({ phone }: PhoneNumberCardProps) {
  const quality = qualityMeta(phone.qualityRating);

  return (
    <WhatsAppSection
      title="Número de WhatsApp Business"
      description="Activo conectado a la API de Meta (solo lectura)"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border text-cyan-500">
          <Phone aria-hidden className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="break-words text-lg font-semibold text-foreground">
            {phone.displayPhoneNumber ?? "Sin número"}
          </p>
          <p className="text-xs text-muted-foreground">{phone.verifiedName ?? "Sin nombre verificado"}</p>
        </div>
      </div>

      <dl className="mt-1">
        <Field label="Calidad del número">
          <SemanticBadge label={quality.label} className={quality.className} />
        </Field>
        <Field label="Límite de mensajería" value={messagingTierLabel(phone.messagingLimitTier)} />
        <Field label="Estado del nombre" value={nameStatusLabel(phone.nameStatus)} />
        <Field label="Verificación" value={codeVerificationLabel(phone.codeVerificationStatus)} />
        <Field label="Plataforma" value={phone.platformType} />
      </dl>
    </WhatsAppSection>
  );
}
