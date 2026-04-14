import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/twilio";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirestore(getAdminApp());

    const snapshot = await db.collection("crm_data").get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const clients = data.clients || [];
      const lastActivity = data.lastActivity;

      let totalTasks = 0;
      let completed = 0;
      let inProgress = 0;
      let stopped = 0;
      let pendiente = 0;
      const stoppedNames: string[] = [];
      const inProgressNames: string[] = [];

      clients.forEach((c: any) => {
        c.projects?.forEach((p: any) => {
          p.tasks?.forEach((t: any) => {
            totalTasks++;
            if (t.status === "completado") completed++;
            else if (t.status === "proceso") {
              inProgress++;
              inProgressNames.push(`${t.name} (${p.name})`);
            } else if (t.status === "detenido") {
              stopped++;
              stoppedNames.push(`${t.name} (${p.name})`);
            } else pendiente++;
          });
        });
      });

      const pct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

      const hoursSinceActivity = lastActivity
        ? Math.round((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60))
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
    }

    return NextResponse.json({ success: true, message: "Notifications sent" });
  } catch (error) {
    console.error("Daily notification error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
