# whatsapp_business_messaging — use case (paste as-is)

**App:** PixelTEC BOT · **Product:** Pixeltec.mx CRM, WhatsApp module ("PixelBot Console") at https://pixeltec.mx/whatsapp

PixelTEC is a technology provider (Business Verification approved; Tech Provider registration in progress). Our CRM includes a WhatsApp customer-service inbox built on the WhatsApp Business Platform Cloud API. Businesses use it to read and answer the WhatsApp messages their customers send to the business phone number.

How the permission is used inside the app:

1. Incoming customer messages to the business number are received through the WhatsApp webhook and shown in the **Inbox** tab as conversations (text, media, delivery/read status).
2. An agent opens a conversation, clicks **Tomar control** ("Take control") to pause the automated assistant, writes a reply in the composer and clicks **Enviar** ("Send"). The app calls `POST /{phone-number-id}/messages` and the customer receives the reply on WhatsApp within the 24-hour customer-service window.
3. Outside the 24-hour window the composer requires an approved message template, exactly as the platform mandates; free text is blocked in the UI.
4. Delivery and read receipts are received via the `messages` webhook field and displayed next to each message.

We request Advanced Access because the same integration powers our multi-business platform: client businesses onboard their own WhatsApp Business Accounts through Embedded Signup and their agents answer their customers from the same inbox. No message content is sold, shared with third parties or used for advertising; data is stored only to display the conversation to the business that owns the phone number.

Screencast: the video shows a full login, the Inbox tab, taking control of a conversation, sending a reply, and the message arriving on the customer's WhatsApp client.
