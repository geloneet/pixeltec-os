import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { createNotification } from "@/lib/notifications/actions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getFullCrmData } from "@/lib/db/repos/crm-sync";

export async function GET(req: NextRequest) {
  const provided = req.headers.get("authorization")?.replace("Bearer ", "") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fase 4: antes se iteraban todos los docs `crm_data/{uid}` de Firestore
    // — ahora se itera por usuario real de Postgres.
    const allUsers = await db.select({ id: users.id }).from(users);

    for (const u of allUsers) {
      const data = await getFullCrmData(u.id);
      const clientsData = data.clients;

      let totalTasks = 0;
      let completed = 0;
      let inProgress = 0;
      let stopped = 0;
      let pendiente = 0;
      const stoppedNames: string[] = [];
      const inProgressNames: string[] = [];
      let lastActivityMs = 0;

      clientsData.forEach((c) => {
        lastActivityMs = Math.max(lastActivityMs, new Date(c.createdAt).getTime());
        c.projects?.forEach((p) => {
          lastActivityMs = Math.max(lastActivityMs, new Date(p.createdAt).getTime());
          p.tasks?.forEach((t) => {
            lastActivityMs = Math.max(lastActivityMs, new Date(t.createdAt).getTime());
            totalTasks++;
            if (t.status === "completado") completed++;
            else if (t.status === "en_progreso" || t.status === "en_revision") {
              inProgress++;
              inProgressNames.push(`${t.name} (${p.name})`);
            } else if (t.status === "pausado" || t.status === "bloqueado") {
              stopped++;
              stoppedNames.push(`${t.name} (${p.name})`);
            } else pendiente++;
          });
        });
      });

      const pct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

      const hoursSinceActivity = lastActivityMs
        ? Math.round((Date.now() - lastActivityMs) / (1000 * 60 * 60))
        : 999;

      let msg = `*PixelTEC CRM - Reporte diario*\n\n`;

      if (hoursSinceActivity > 24) {
        msg += `⚠️ Llevas *${hoursSinceActivity}h* sin actividad en el CRM. ¡Abre tu centro de mando!\n\n`;
      }

      msg += `📊 *Progreso general:* ${pct}%\n`;
      msg += `✅ Completadas: ${completed}/${totalTasks}\n`;
      msg += `🔄 En proceso: ${inProgress}\n`;
      msg += `🔴 Detenidas: ${stopped}\n`;
      msg += `⏳ Pendientes: ${pendiente}\n\n`;

      if (stoppedNames.length > 0) {
        msg += `*🚨 DETENIDAS - Necesitan tu atención:*\n`;
        stoppedNames.slice(0, 5).forEach((n) => {
          msg += `  • ${n}\n`;
        });
        msg += `\n`;
      }

      if (inProgressNames.length > 0) {
        msg += `*🎯 En progreso hoy:*\n`;
        inProgressNames.slice(0, 5).forEach((n) => {
          msg += `  • ${n}\n`;
        });
        msg += `\n`;
      }

      if (pct === 100) {
        msg += `🏆 ¡Todas las tareas completadas! Define nuevos objetivos.`;
      } else if (pct >= 75) {
        msg += `💪 Vas al ${pct}%. ¡Estás cerca de completar todo!`;
      } else if (pct >= 50) {
        msg += `🔥 Más de la mitad hecho. No pares ahora.`;
      } else if (pct > 0) {
        msg += `🚀 Cada tarea completada es un paso adelante. ¡Enfócate en una sola!`;
      } else {
        msg += `⭐ Empieza por la tarea más pequeña. El momentum se construye.`;
      }

      msg += `\n\n👉 pixeltec.mx/crm`;

      await sendWhatsApp(msg);

      // In-app daily summary notification
      const summaryBody = `Progreso general: ${pct}% — ${completed}/${totalTasks} tareas completadas. En proceso: ${inProgress}. Detenidas: ${stopped}. Pendientes: ${pendiente}.`;
      try {
        await createNotification({
          userId: u.id,
          type: "info",
          title: "Resumen diario",
          body: summaryBody,
          href: "/tareas",
          source: "daily-cron",
        });
      } catch (e) {
        console.error("In-app daily notification FAILED:", e);
      }
    }

    return NextResponse.json({ success: true, message: "Notifications sent" });
  } catch (error) {
    console.error("Daily notification error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
