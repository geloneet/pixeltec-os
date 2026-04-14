import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendWhatsApp(message: string) {
  try {
    const result = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to: process.env.TWILIO_WHATSAPP_TO!,
      body: message,
    });
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error };
  }
}
