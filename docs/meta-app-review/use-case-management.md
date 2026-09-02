# whatsapp_business_management — use case (paste as-is)

**App:** PixelTEC BOT · **Product:** Pixeltec.mx CRM, WhatsApp module at https://pixeltec.mx/whatsapp → **Cuenta** ("Account") tab

PixelTEC is a technology provider (Business Verification approved; Tech Provider registration in progress). Our CRM lets a business see and manage the WhatsApp Business Account assets connected to the app without leaving the CRM.

How the permission is used inside the app:

1. **Phone number**: the Account tab reads the business phone number through `GET /{phone-number-id}` (display number, verified name, quality rating, messaging limit tier, verification status) so the business can see the health of its number.
2. **Business profile**: the tab reads `GET /{phone-number-id}/whatsapp_business_profile` (about, address, description, email, website, vertical) and shows it to the business.
3. **Message templates**: the tab lists the WABA templates through `GET /{waba-id}/message_templates` with their status (approved, pending, rejected, paused) and category, and lets the business **create a new template** with `POST /{waba-id}/message_templates` (name, language, category UTILITY or MARKETING, body with sample values, optional footer). Templates are needed to contact customers outside the 24-hour window from the Inbox.

We request Advanced Access because client businesses onboard their own WhatsApp Business Accounts through Embedded Signup, and the app must read their phone numbers and templates and create templates on their behalf. The app never modifies a client's assets without an explicit action by that business's user in the UI.

Screencast: the video shows a full login, the Account tab with the phone number and business profile, the template list, and the creation of a new template from the app (the new template appears in the list with status "Pending").
