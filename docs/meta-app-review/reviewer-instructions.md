# Reviewer instructions (paste into "Testing instructions"; fill the two brackets, never commit the password)

Thank you for reviewing PixelTEC BOT. Everything you need is in one page of our CRM.

**Login**
- URL: https://pixeltec.mx/login
- Email: meta-review@pixeltec.mx
- Password: [PASTE IN THE META FORM ONLY]
- No two-factor prompt. After login you land on https://pixeltec.mx/whatsapp. This account is restricted to the WhatsApp module by design.

**A short guide in English is shown at the top of the page for this account.** The product UI is in Spanish; the key labels are: *Bandeja* = Inbox · *Cuenta* = Account · *Tomar control* = Take control · *Enviar* = Send · *Nueva plantilla* = New template · *Crear* = Create.

**whatsapp_business_messaging (Inbox tab)**
1. From any WhatsApp account, send a message to our business number **[BUSINESS NUMBER, international format]**. It appears in the Inbox within a few seconds (our assistant may auto-reply first; that is expected).
2. Open the conversation, click **Tomar control**, type a reply and click **Enviar**. The reply is delivered to your WhatsApp through the Cloud API (`POST /{phone-number-id}/messages`) and shows delivery/read ticks in the thread.

**whatsapp_business_management (Account tab)**
1. Click **Cuenta**. You will see the phone number card (`GET /{phone-number-id}`), the business profile (`GET /{phone-number-id}/whatsapp_business_profile`) and the list of message templates with their status (`GET /{waba-id}/message_templates`).
2. Click **Nueva plantilla**, fill name (lowercase and underscores), language, category (UTILITY or MARKETING), body text with optional `{{1}}` variables and their sample values, then **Crear**. The template is created with `POST /{waba-id}/message_templates` and appears in the list as "En revisión" (pending).

Nothing else in the CRM is required for this review; other areas are intentionally hidden for this account. Privacy policy: https://pixeltec.mx/aviso-de-privacidad · Data deletion: https://pixeltec.mx/data-deletion
