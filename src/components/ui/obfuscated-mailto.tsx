"use client";

import { useEffect, useState } from "react";

interface ObfuscatedMailtoProps {
  email: string;
  subject?: string;
  body?: string;
  className?: string;
  /** Texto/JSX visible una vez montado. Por defecto, el email tal cual. */
  children?: React.ReactNode;
}

/**
 * Link `mailto:` que evita el error de hidratación causado por la
 * ofuscación de emails de Cloudflare (Scrape Shield): Cloudflare reescribe,
 * en el HTML crudo de la respuesta, cualquier `mailto:` + email visible que
 * detecte (`href="/cdn-cgi/l/email-protection#..."` y texto `[email
 * protected]`) ANTES de que React hidrate. Como el HTML que React genera en
 * el cliente trae el valor original, hay mismatch → "Objects are not valid
 * as a React child" / error de hidratación visible para el usuario.
 *
 * Fix: no renderizar el email/mailto literal durante el SSR ni en el primer
 * paint — así Cloudflare no tiene nada que reescribir y el primer render del
 * cliente coincide con el del servidor. Tras montar, se revela el link real.
 * No es un parche de `suppressHydrationWarning` (eso dejaría el href roto de
 * Cloudflare si el navegador no llegara a hidratar).
 */
export function ObfuscatedMailto({ email, subject, body, className, children }: ObfuscatedMailtoProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span className={className} aria-hidden="true">
        &nbsp;
      </span>
    );
  }

  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();

  return (
    <a href={`mailto:${email}${query ? `?${query}` : ""}`} className={className}>
      {children ?? email}
    </a>
  );
}
