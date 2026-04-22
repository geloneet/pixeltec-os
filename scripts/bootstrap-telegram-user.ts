// scripts/bootstrap-telegram-user.ts
// Script de uso único para autorizarte como "owner" del bot.
//
// USO:
//   1. Mandarle un mensaje al bot (aunque responda "⛔ privado") para que
//      Telegram genere tu ID.
//   2. Ir a: https://api.telegram.org/bot<TU_TOKEN>/getUpdates
//      Copiar el "from.id" de tu mensaje (número entero).
//   3. Ejecutar: npx tsx scripts/bootstrap-telegram-user.ts <TU_TELEGRAM_ID>
//
// Después de esto, el bot ya responderá a tus comandos.

import { config } from "dotenv";
config({ path: ".env.local" });

import { db, COL } from "../src/lib/crypto-intel/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

async function main() {
  const telegramId = process.argv[2];
  if (!telegramId || !/^\d+$/.test(telegramId)) {
    console.error("Uso: npx tsx scripts/bootstrap-telegram-user.ts <TELEGRAM_ID>");
    console.error("El ID es un número entero (ej: 123456789)");
    process.exit(1);
  }

  const firstName = process.argv[3] ?? "Miguel";

  await db().collection(COL.telegramUsers).doc(telegramId).set({
    telegramUserId: Number(telegramId),
    firstName,
    timezone: "America/Mexico_City",
    role: "owner",
    authorized: true,
    createdAt: Timestamp.now(),
  });

  console.log(`✅ Usuario ${telegramId} (${firstName}) autorizado como owner.`);
  console.log("Ahora mándale /start al bot en Telegram.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
