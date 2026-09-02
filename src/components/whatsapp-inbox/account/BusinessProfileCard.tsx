import type { BusinessProfile } from "@/lib/whatsapp/management-types";
import { WhatsAppSection } from "../ui/WhatsAppSection";
import { Field } from "./Field";
import { verticalLabel } from "./meta";

interface BusinessProfileCardProps {
  profile: BusinessProfile;
}

/**
 * Perfil de empresa del número, **solo lectura** (editarlo queda fuera de
 * WO-2026-00181: cada campo tiene reglas propias de Meta y un formulario de
 * escritura no aporta nada al App Review).
 *
 * La foto se pinta con `<img>` a propósito: la URL la firma el CDN de Meta y
 * caduca, así que no puede pasar por el optimizador de `next/image` (exigiría
 * declarar el host en `next.config` y aun así fallaría al expirar).
 */
export function BusinessProfileCard({ profile }: BusinessProfileCardProps) {
  return (
    <WhatsAppSection title="Perfil de empresa" description="Lo que ve el cliente en WhatsApp (solo lectura)">
      {profile.profilePictureUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={profile.profilePictureUrl}
            alt="Foto de perfil de la empresa"
            className="h-12 w-12 flex-shrink-0 rounded-full border border-border object-cover"
          />
          <p className="text-xs text-muted-foreground">Foto pública del número</p>
        </div>
      ) : null}

      <dl>
        <Field label="Acerca de" value={profile.about} />
        <Field label="Descripción" value={profile.description} />
        <Field label="Dirección" value={profile.address} />
        <Field label="Correo" value={profile.email} />
        <Field label="Sitios web">
          {profile.websites.length > 0 ? (
            <ul className="space-y-0.5">
              {profile.websites.map((site) => (
                <li key={site}>
                  <a
                    href={site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-cyan-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 dark:text-cyan-300"
                  >
                    {site}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted-foreground/60">Sin datos</span>
          )}
        </Field>
        <Field label="Categoría" value={verticalLabel(profile.vertical)} />
      </dl>
    </WhatsAppSection>
  );
}
