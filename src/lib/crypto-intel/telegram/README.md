# Telegram Bot — Crypto Intelligence

## Estructura

```
telegram/
├── bot.ts                  # Singleton + registro de todos los handlers
├── context.ts              # BotContext (tipo compartido)
├── sender.ts               # Envíos proactivos (alert engine)
├── middleware/
│   ├── auth.ts             # Allowlist Firestore + flag isAdmin
│   └── error-handler.ts    # Catch genérico con UI de error
├── keyboards/
│   ├── navigation.ts       # [⬅️ Atrás][🏠 Menú][❌ Cerrar]
│   ├── main-menu.ts        # Menú principal /start
│   ├── prices.ts           # Lista de precios + detalle
│   ├── alerts.ts           # Lista de alertas
│   └── admin.ts            # Panel de admin
├── handlers/
│   ├── start.ts            # /start y nav:home
│   ├── prices.ts           # /precios y prices:*
│   ├── alerts.ts           # /alertas, flujo nueva alerta, alerts:*
│   ├── portfolio.ts        # /portfolio (placeholder)
│   └── admin.ts            # /status, /sync, /users, /logs, admin:*
├── views/
│   └── templates.ts        # Funciones que generan el texto HTML
└── scripts/
    └── setup-commands.ts   # Registra comandos en Telegram (ejecutar post-deploy)
```

## Cómo añadir un nuevo comando

1. Crea el handler en `handlers/<modulo>.ts`:
   ```ts
   export async function handleMiComando(ctx: BotContext): Promise<void> {
     const markup = navKeyboard("home");
     if (ctx.callbackQuery) {
       await ctx.editMessageText("...", { parse_mode: "HTML", reply_markup: markup });
     } else {
       await ctx.reply("...", { parse_mode: "HTML", reply_markup: markup });
     }
   }
   ```

2. Registra en `bot.ts`:
   ```ts
   bot.command("micomando", (ctx) =>
     handleMiComando(ctx).catch((err) => handleError(ctx, err, "cmd:micomando"))
   );
   ```

3. Añade a `scripts/setup-commands.ts` en `USER_COMMANDS` (o `ADMIN_COMMANDS`).

4. Ejecuta el script de setup:
   ```bash
   npx tsx src/lib/crypto-intel/telegram/scripts/setup-commands.ts
   ```

## Cómo añadir un botón al menú principal

1. En `keyboards/main-menu.ts`:
   ```ts
   kb.row().text("🆕 Mi sección", "miseccion:view");
   ```

2. En `bot.ts`, registra el callback:
   ```ts
   bot.callbackQuery("miseccion:view", async (ctx) => {
     await ctx.answerCallbackQuery();
     await handleMiSeccion(ctx).catch((err) => handleError(ctx, err, "cb:miseccion:view"));
   });
   ```

## Esquema de callback_data

Los prefijos son namespaced para evitar colisiones:

| Prefijo | Destino |
|---------|---------|
| `nav:home` | Menú principal |
| `nav:close` | Cerrar mensaje |
| `nav:back:<parent>` | Pantalla anterior |
| `nav:help` | Ayuda |
| `prices:view` | Lista de precios |
| `prices:detail:<SYM>:<from>` | Detalle de asset |
| `alerts:list` | Lista de alertas |
| `alerts:new:1` | Nueva alerta paso 1 |
| `alerts:del:<id>` | Eliminar alerta |
| `portfolio:view` | Portfolio |
| `admin:status` | Estado del sistema |
| `admin:sync` | Forzar sync |
| `admin:logs` | Logs |
| `admin:users` | Usuarios |

> Telegram limita callback_data a 64 bytes. Mantener IDs y símbolos cortos.

## Registrar comandos tras cada deploy

```bash
npx tsx src/lib/crypto-intel/telegram/scripts/setup-commands.ts
```

Requiere `TELEGRAM_BOT_TOKEN` en `.env.local` o `.env`.

## Variables de entorno

Ninguna nueva. Las mismas de siempre:

| Variable | Uso |
|----------|-----|
| `TELEGRAM_BOT_TOKEN` | Token del bot (@BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Valida updates de Telegram en el webhook |

## Comandos deprecated

| Comando anterior | Reemplazado por |
|------------------|-----------------|
| `/precio <SYM>` | `/precios` + botón de detalle por símbolo |
| `/watchlist` | Vista dentro de `/precios` |
| `/nuevaalerta` | Botón "➕ Nueva alerta" en el menú de alertas |
| `/borrar <id>` | Botón "🗑" en el listado de `/alertas` |

Los comandos deprecated siguen funcionando: `/precio` y `/watchlist` redirigen
a la pantalla de precios; `/nuevaalerta` inicia el flujo de sesión; `/borrar <id>`
sigue aceptando el ID directamente para compatibilidad.
