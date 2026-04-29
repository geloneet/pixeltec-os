import { Bot, type Context, InlineKeyboard } from 'grammy';
import { isAllowedChat, logCommand } from './telegram-auth';
import { createSilence, checkSilence } from './silence';
import { db } from '@/lib/assistant/firebase-admin';

let _bot: Bot | null = null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function denied(ctx: Context, command: string): Promise<void> {
  await logCommand({
    command,
    chatId:   ctx.chat?.id ?? 0,
    username: ctx.from?.username,
    result:   'denied',
  });
  await ctx.reply('🔒 Bot privado. Acceso denegado.');
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
      '/status — estado del cron + heartbeat\n' +
      '/last_report — último weekly report\n' +
      '/health — ping al VPS y app\n' +
      '/force_rollover — dispara rollover (con confirmación)\n' +
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
      '/status — estado del cron + último heartbeat\n' +
      '/last_report — detalle del último weekly report\n' +
      '/health — health check de la app\n\n' +
      '<b>Mutaciones:</b>\n' +
      '/force_rollover — fuerza rollover semanal manualmente (requiere confirmación)\n' +
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
      const ageDays    = await getHeartbeatAgeDays();
      const sil        = await checkSilence();
      const lastReport = await getLastReportSummary();

      const lines = [
        '📊 <b>Estado PixelTEC Infra</b>',
        '',
        `<b>Cron rollover:</b> ${ageDays === null ? 'sin heartbeat' : `último hace ${ageDays}d`}`,
        `<b>Silencio:</b> ${sil.silenced ? `activo hasta ${sil.expiresAt?.toISOString()}` : 'inactivo'}`,
        `<b>Último reporte:</b> ${lastReport ?? 'sin datos'}`,
        '',
        `<i>${new Date().toISOString()}</i>`,
      ];

      const kb = new InlineKeyboard()
        .text('🔁 Refresh', 'cmd:status')
        .text('📊 Detalle', 'cmd:last_report');

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

  // /last_report
  bot.command('last_report', async (ctx) => {
    const t0 = Date.now();
    try {
      const detail = await getLastReportDetail();
      await ctx.reply(detail, { parse_mode: 'HTML' });
      await logCommand({
        command:    '/last_report',
        chatId:     ctx.chat!.id,
        username:   ctx.from?.username,
        result:     'ok',
        durationMs: Date.now() - t0,
      });
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : 'unknown'}`);
      await logCommand({
        command:      '/last_report',
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

  // /force_rollover (solicita confirmación via botones)
  bot.command('force_rollover', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('✅ Sí, ejecutar', 'force_rollover:confirm')
      .text('❌ Cancelar',     'force_rollover:cancel');
    await ctx.reply(
      '⚠️ <b>Confirmar force rollover</b>\n\n' +
      'Esto ejecuta performWeeklyRollover() para la semana actual. ' +
      'Si ya hay reporte, será idempotente (counts 0/0). ' +
      'Si no, archivará tasks reales y generará nueva semana.\n\n' +
      '¿Proceder?',
      { parse_mode: 'HTML', reply_markup: kb },
    );
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

  // Callback: force_rollover confirm/cancel
  bot.callbackQuery(/^force_rollover:(confirm|cancel)$/, async (ctx) => {
    const action = ctx.match?.[1];
    await ctx.answerCallbackQuery();

    if (action === 'cancel') {
      await ctx.editMessageText('❌ Force rollover cancelado.');
      return;
    }

    try {
      const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
      const cronSecret = process.env.CRON_SECRET;
      const res  = await fetch(`${baseUrl}/api/cron/asistente/weekly-rollover`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json() as unknown;
      await ctx.editMessageText(
        `✅ Rollover ejecutado\n<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`,
        { parse_mode: 'HTML' },
      );
      await logCommand({
        command:  '/force_rollover',
        args:     'confirmed',
        chatId:   ctx.chat!.id,
        username: ctx.from?.username,
        result:   'ok',
      });
    } catch (err) {
      await ctx.editMessageText(`❌ Error: ${err instanceof Error ? err.message : 'unknown'}`);
      await logCommand({
        command:      '/force_rollover',
        chatId:       ctx.chat!.id,
        result:       'error',
        errorMessage: err instanceof Error ? err.message : 'unknown',
      });
    }
  });

  // Callback: refresh status
  bot.callbackQuery('cmd:status', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔁 Refresh...' });
    await ctx.reply('Manda /status para refrescar.');
  });

  // Callback: last_report detail
  bot.callbackQuery('cmd:last_report', async (ctx) => {
    await ctx.answerCallbackQuery();
    const detail = await getLastReportDetail();
    await ctx.reply(detail, { parse_mode: 'HTML' });
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

  // Callback: rerun_rollover (desde botones de watchdog crítico)
  bot.callbackQuery('rerun_rollover', async (ctx) => {
    await ctx.answerCallbackQuery({ text: '🔁 Disparando rollover...' });
    try {
      const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pixeltec.mx';
      const cronSecret = process.env.CRON_SECRET;
      const res  = await fetch(`${baseUrl}/api/cron/asistente/weekly-rollover`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json() as unknown;
      await ctx.reply(
        `Rollover ejecutado: <pre>${escapeHtml(JSON.stringify(data))}</pre>`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      await ctx.reply(`❌ ${err instanceof Error ? err.message : 'unknown'}`);
    }
  });

  _bot = bot;
  return bot;
}

// --- Firestore helpers ---

async function getHeartbeatAgeDays(): Promise<number | null> {
  // Heartbeat real vive en el FS del VPS. Usamos generatedAt del último
  // weekly report como proxy — misma señal que el watchdog monitorea.
  try {
    const snap = await db()
      .collection('assistantWeeklyReports')
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const createdMs = snap.docs[0].data().generatedAt?.toMillis() ?? 0;
    return Math.floor((Date.now() - createdMs) / 86400000);
  } catch {
    return null;
  }
}

async function getLastReportSummary(): Promise<string | null> {
  try {
    const snap = await db()
      .collection('assistantWeeklyReports')
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc    = snap.docs[0].data();
    const totals = doc.totals ?? {};
    return `${doc.weekKey} · total ${totals.total ?? 0} · completadas ${totals.completed ?? 0}`;
  } catch {
    return null;
  }
}

async function getLastReportDetail(): Promise<string> {
  try {
    const snap = await db()
      .collection('assistantWeeklyReports')
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return '<i>No hay reportes todavía.</i>';
    const doc    = snap.docs[0].data();
    const totals = doc.totals ?? {};
    const lines  = [
      `📊 <b>Reporte ${doc.weekKey}</b>`,
      '',
      `<b>Total tasks:</b> ${totals.total ?? 0}`,
      `<b>Completadas:</b> ${totals.completed ?? 0}`,
      `<b>Pendientes:</b> ${totals.pending ?? 0}`,
      `<b>En progreso:</b> ${totals.inProgress ?? 0}`,
      `<b>Canceladas:</b> ${totals.cancelled ?? 0}`,
      `<b>Postponed:</b> ${totals.postponed ?? 0}`,
      '',
      `<i>Generado: ${doc.generatedAt?.toDate()?.toISOString() ?? '?'}</i>`,
      `<i>Trigger: ${doc.generatedBy ?? '?'}</i>`,
    ];
    return lines.join('\n');
  } catch (err) {
    return `❌ Error leyendo reporte: ${err instanceof Error ? err.message : 'unknown'}`;
  }
}

export { getBot };
