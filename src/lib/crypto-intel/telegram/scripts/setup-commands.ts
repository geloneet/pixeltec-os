#!/usr/bin/env tsx
// Registra los comandos del bot en Telegram vía setMyCommands.
// Idempotente — ejecutar tras cada deploy.
//
// Uso:
//   npx tsx src/lib/crypto-intel/telegram/scripts/setup-commands.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Bot } from "grammy";

const ADMIN_ID = 1154245961;

const USER_COMMANDS = [
  { command: "start",     description: "Menú principal" },
  { command: "precios",   description: "Ver precios actuales" },
  { command: "alertas",   description: "Gestionar alertas" },
  { command: "portfolio", description: "Ver portafolio" },
  { command: "ayuda",     description: "Ayuda y comandos" },
];

const ADMIN_COMMANDS = [
  ...USER_COMMANDS,
  { command: "status", description: "Estado del sistema" },
  { command: "sync",   description: "Forzar sync de precios" },
  { command: "users",  description: "Usuarios autorizados" },
  { command: "logs",   description: "Ver últimos errores" },
];

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌  TELEGRAM_BOT_TOKEN no está configurado");
    process.exit(1);
  }

  const bot = new Bot(token);
  await bot.init();
  console.log(`🤖  Bot: @${bot.botInfo.username}`);

  await bot.api.setMyCommands(USER_COMMANDS, { scope: { type: "default" } });
  console.log("✓  Comandos de usuario registrados (scope: default)");

  await bot.api.setMyCommands(ADMIN_COMMANDS, {
    scope: { type: "chat", chat_id: ADMIN_ID },
  });
  console.log(`✓  Comandos de admin registrados (chat_id: ${ADMIN_ID})`);

  console.log("✅  Setup completo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Error en setup:", err);
  process.exit(1);
});
