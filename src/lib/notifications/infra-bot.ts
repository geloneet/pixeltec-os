import { Bot, type Context, InlineKeyboard } from 'grammy';
import { isAllowedChat, logCommand } from './telegram-auth';
import { createSilence, checkSilence } from './silence';

let _bot: Bot | null = null;

async function denied(ctx: Context, command: string): Promise<void> {
  await logCommand({
    command,
    chatId:   ctx.chat?.id ?? 0,
    username: ctx.from?.username,
    result:   'denied',
  });
  try {
    await ctx.reply('🔒 Bot privado. Acceso denegado.');
  } catch {
    // chat may not exist (e.g. during local testing with fake chatIds)
  }
}

function getBot(): Bot {
  if (_bot) return _bot;

  const token = process.env.TELEGRAM_INFRA_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_INFRA_BOT_TOKEN no configurado');

  const bot = new Bot(token);

  // Allowlist middleware
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (!chatId || !isAllowedChat(chatId)) {
      const cmd = ctx.message?.text?.split(' ')[0] ?? 'callback';
      return denied(ctx, cmd);
    }
    await next();
  });

  // /start
  bot.command('start', async (ctx) => {
    const t0 = Date.now();
    await ctx.reply(
      '👋 <b>PixelTEC Infra Alerts</b>\n\n' +
      'Bot interno de operaciones VPS. Comandos disponibles:\n\n' +
      '/help — lista completa\n' +
      '/status — estado del bot\n' +
      '/health — ping al VPS y app\n' +
      '/silence_alerts &lt;horas&gt; — silenciar alertas N horas',
      { parse_mode: 'HTML' },
    );
    await logCommand({
      command:    '/start',
      chatId:     ctx.chat!.id,
      username:   ctx.from?.username,
      result:     'ok',
      durationMs: Date.now() - t0,
    });
  });

  // /help
  bot.command('help', async (ctx) => {
    const t0 = Date.now();
    await ctx.reply(
      '<b>Comandos PixelTEC Infra</b>\n\n' +
      '<b>Read-only:</b>\n' +
      '/status — estado del bot\n' +
      '/health — health check de la app\n\n' +
      '<b>Mutaciones:</b>\n' +
      '/silence_alerts &lt;horas&gt; — silencia alertas (max 168h = 7 días). ' +
      'Critical bypassa el silencio.\n\n' +
      '<i>Tip: muchos mensajes traen botones inline para acciones rápidas.</i>',
      { parse_mode: 'HTML' },
    );
    await logCommand({
      command:    '/help',
      chatId:     ctx.chat!.id,
      username:   ctx.from?.username,
      result:     'ok',
      durationMs: Date.now() - t0,
    });
  });

  // /status
  bot.command('status', async (ctx) => {
    const t0 = Date.now();
    try {
      const sil = await checkSilence();

      const lines = [
        '📊 <b>Estado PixelTEC Infra</b>',
        '',
        `<b>Silencio:</b> ${sil.silenced ? `activo hasta ${sil.expiresAt?.toISOString()}` : 'inactivo'}`,
        '',
        `<i>${new Date().toISOString()}</i>`,
      ];

      const kb = new InlineKeyboard()
        .text('🔁 Refresh', 'cmd:status');

      await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: kb });
      await logCommand({
        command:    '/status',
        chatId:     ctx.chat!.id,
        username:   ctx.from?.username,
        result:     'ok',
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'unknown'}`);
      await logCommand({
        command:      '/status',
        chatId:       ctx.chat!.id,
        result:       'error',
        errorMessage: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // /health
  bot.command('health', async (ctx) => {
    const t0 = Date.now();
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
      const res     = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      await ctx.reply(
        res.ok
          ? `✅ /api/health OK · HTTP ${res.status} · ${Date.now() - t0}ms`
          : `⚠️ /api/health degraded · HTTP ${res.status}`,
      );
      await logCommand({
        command:    '/health',
        chatId:     ctx.chat!.id,
        username:   ctx.from?.username,
        result:     'ok',
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      await ctx.reply(`❌ Health check falló: ${err instanceof Error ? err.message : 'unknown'}`);
      await logCommand({
        command:      '/health',
        chatId:       ctx.chat!.id,
        result:       'error',
        errorMessage: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // /silence_alerts <horas>
  bot.command('silence_alerts', async (ctx) => {
    const t0  = Date.now();
    const arg = ctx.match?.toString().trim();
    const hours = parseInt(arg ?? '', 10);
    if (!arg || isNaN(hours) || hours <= 0) {
      await ctx.reply(
        'Uso: <code>/silence_alerts &lt;horas&gt;</code>\n' +
        'Ejemplo: <code>/silence_alerts 24</code>\nMax: 168 (7 días).',
        { parse_mode: 'HTML' },
      );
      return;
    }

    const result = await createSilence({
      hours,
      silencedBy: String(ctx.chat!.id),
      reason:     'via Telegram bot',
    });

    if (!result.ok) {
      await ctx.reply(`❌ ${result.error}`);
      await logCommand({
        command:      '/silence_alerts',
        args:         arg,
        chatId:       ctx.chat!.id,
        result:       'error',
        errorMessage: result.error,
      });
      return;
    }

    await ctx.reply(
      `🔇 Alertas silenciadas hasta <b>${result.expiresAt.toISOString()}</b> (${hours}h).\n` +
      `<i>Critical bypassa el silencio.</i>`,
      { parse_mode: 'HTML' },
    );
    await logCommand({
      command:    '/silence_alerts',
      args:       arg,
      chatId:     ctx.chat!.id,
      username:   ctx.from?.username,
      result:     'ok',
      durationMs: Date.now() - t0,
    });
  });

  // Callback: refresh status
  bot.callbackQuery('cmd:status', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔁 Refresh...' });
    await ctx.reply('Manda /status para refrescar.');
  });

  // Callback: silence Nh (desde botones inline de alertas outbound)
  bot.callbackQuery(/^silence:(\d+)h$/, async (ctx) => {
    const hours = parseInt(ctx.match?.[1] ?? '0', 10);
    await ctx.answerCallbackQuery();
    if (hours <= 0) {
      await ctx.reply('Hours inválidas');
      return;
    }
    const result = await createSilence({
      hours,
      silencedBy: String(ctx.chat!.id),
      reason:     'via inline button',
    });
    if (result.ok) {
      await ctx.reply(`🔇 Silenciado ${hours}h hasta ${result.expiresAt.toISOString()}`);
    } else {
      await ctx.reply(`❌ ${result.error}`);
    }
  });

  _bot = bot;
  return bot;
}

export { getBot };
