/**
 * Envío de recordatorio de cobro — email + WhatsApp. Extraído de
 * `api/notifications/billing-charges/route.ts` (ADR-0040) para que el cron
 * nuevo de recurrentes (Parte C/D, 2026-08-27) y el botón de recordatorio
 * manual usen EXACTAMENTE el mismo transporte, sin duplicar la plantilla.
 */
import 'server-only';
import { sendEmail } from '@/lib/email';
import { sendWhatsApp } from '@/lib/whatsapp/sender';

export interface BillingReminderInput {
  clientName: string;
  clientEmail: string | null;
  concept: string;
  amount: string;
  currency: string;
  dueDate: Date;
  overdue: boolean;
}

export interface BillingReminderResult {
  emailOk: boolean;
}

export async function sendBillingReminder(input: BillingReminderInput): Promise<BillingReminderResult> {
  const dateStr = input.dueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const amountStr = new Intl.NumberFormat('es-MX', { style: 'currency', currency: input.currency }).format(
    Number(input.amount),
  );

  let emailOk = true;
  if (input.clientEmail) {
    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#000;padding:28px 32px;"><p style="margin:0;font-size:20px;font-weight:700;color:#fff;">Pixel<span style="color:#06b6d4;">TEC</span></p></div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#09090b;">${input.overdue ? 'Cobro vencido' : 'Cobro próximo'}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
        Hola ${input.clientName}, ${input.overdue ? 'el siguiente cobro venció el' : 'el siguiente cobro vence el'}
        <strong>${dateStr}</strong>: <strong>${input.concept}</strong> — ${amountStr}.
      </p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">PixelTEC — pixeltec.mx</p>
    </div>
  </div>
</body></html>`;
    try {
      const result = await sendEmail(
        input.clientEmail,
        `${input.overdue ? 'Cobro vencido' : 'Recordatorio de cobro'} — ${input.concept}`,
        html,
      );
      emailOk = result.success;
    } catch (e) {
      emailOk = false;
      console.error('[reminder-notify] email send threw:', e instanceof Error ? e.name : typeof e);
    }
  }

  try {
    await sendWhatsApp(
      `*${input.overdue ? 'Cobro vencido' : 'Cobro próximo'} — ${input.clientName}*\n\n` +
        `*Concepto:* ${input.concept}\n*Monto:* ${amountStr}\n*Fecha:* ${dateStr}\n\npixeltec.mx/cobros`,
    );
  } catch (e) {
    console.error('[reminder-notify] whatsapp send failed:', e instanceof Error ? e.name : typeof e);
  }

  return { emailOk };
}
