"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useIsRestrictedRole } from "@/hooks/use-restricted-role";
import { useWhatsAppAccount } from "@/hooks/use-whatsapp-account";

const DISMISS_KEY = "wa-reviewer-guide-dismissed";

/**
 * Guía para el revisor de Meta (WO-2026-00181).
 *
 * En **inglés** a propósito: el producto habla español y así seguirá, pero
 * Meta exige que el revisor pueda reproducir el flujo sin ayuda, y el revisor
 * no habla español. El mini glosario cubre las cuatro palabras que tendrá que
 * reconocer en pantalla mientras graba el screencast.
 *
 * Solo la ve un rol restringido: para admin/staff la pantalla queda idéntica a
 * como estaba.
 */
export function ReviewerGuide() {
  const isRestricted = useIsRestrictedRole();
  // `undefined` (sesión cargando) NO pinta el banner: aparecer y desaparecer
  // sería peor que aparecer medio segundo tarde.
  if (isRestricted !== true) return null;
  return <ReviewerGuideBanner />;
}

const GLOSSARY: [string, string][] = [
  ["Bandeja", "Inbox"],
  ["Cuenta", "Account"],
  ["Tomar control", "Take control"],
  ["Enviar", "Send"],
  ["Nueva plantilla", "New template"],
  ["Crear", "Create"],
];

/**
 * Cuerpo del banner, en un componente aparte para que el hook de cuenta —y su
 * request— solo corra cuando el banner realmente se muestra.
 */
function ReviewerGuideBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { account } = useWhatsAppAccount();
  const displayPhoneNumber = account?.phone?.displayPhoneNumber ?? null;

  // Se lee en un efecto (no en el estado inicial) para no desalinear el HTML
  // del servidor con el del cliente. `sessionStorage` puede lanzar en modo
  // privado o con cookies bloqueadas: nunca debe tumbar el módulo.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* almacenamiento no disponible: el banner simplemente se muestra */
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sin persistencia: se oculta solo en esta vista */
    }
  }

  if (dismissed) return null;

  return (
    <section
      role="region"
      aria-label="Reviewer guide"
      className="relative flex-shrink-0 border-b border-cyan-500/30 bg-cyan-500/5 px-4 py-3 pr-10 text-xs text-foreground"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss reviewer guide"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>

      <p className="font-semibold text-cyan-700 dark:text-cyan-300">Reviewer guide — how to test this app</p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card/50 p-2.5">
          <p className="font-mono text-[11px] text-muted-foreground">whatsapp_business_messaging</p>
          <p className="mt-1">
            <strong>Bandeja</strong> (Inbox) → open a conversation → <strong>Tomar control</strong> (Take control) →
            type your message and press <strong>Enviar</strong> (Send).
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card/50 p-2.5">
          <p className="font-mono text-[11px] text-muted-foreground">whatsapp_business_management</p>
          <p className="mt-1">
            <strong>Cuenta</strong> (Account) → review the phone number, the business profile and the message
            templates → <strong>Nueva plantilla</strong> (New template) → fill the form and press{" "}
            <strong>Crear</strong> (Create).
          </p>
        </div>
      </div>

      {displayPhoneNumber ? (
        <p className="mt-2">
          Message this number from your WhatsApp:{" "}
          <span className="font-semibold text-cyan-700 dark:text-cyan-300">{displayPhoneNumber}</span> — your message
          appears in <strong>Bandeja</strong>.
        </p>
      ) : null}

      <p className="mt-2 text-muted-foreground">
        {GLOSSARY.map(([es, en]) => `${es} = ${en}`).join(" · ")}
      </p>
    </section>
  );
}
