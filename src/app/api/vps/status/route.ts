import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Proyectos pre-definidos (hardcoded por seguridad — NO aceptar input del user)
const PROJECTS = [
  {
    id: "pixeltec-os",
    name: "PixelTEC OS",
    path: "/home/ubuntu/pixeltec-os",
    type: "docker-compose",
    domain: "pixeltec.mx",
    description: "Sitio principal + CRM",
    statusCmd: "docker ps --filter name=pixeltec-os --format '{{.Status}}'",
    sizeCmd: "du -sh /home/ubuntu/pixeltec-os | cut -f1",
  },
  {
    id: "pipas-tondoroque",
    name: "Pipas Tondoroque",
    path: "/home/ubuntu/pipastondoroque",
    type: "docker",
    domain: "pipastondoroque.com",
    description: "Sistema de pedidos de pipas de agua",
    statusCmd: "docker ps --filter name=pipas-container --format '{{.Status}}'",
    sizeCmd: "du -sh /home/ubuntu/pipastondoroque | cut -f1",
  },
  {
    id: "viva-bot",
    name: "Viva Bot",
    path: "/opt/botsAR/VivaaerobusChk",
    type: "pm2",
    description: "Bot de Vivaaerobus",
    statusCmd: "pm2 jlist | node -e \"const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d).find(x=>x.name==='viva-bot');console.log(p?p.pm2_env.status:'stopped')\"",
    sizeCmd: "du -sh /opt/botsAR/VivaaerobusChk | cut -f1",
  },
  {
    id: "teleacceso",
    name: "Teleacceso",
    path: "/opt/botsAR/teleacceso",
    type: "pm2",
    description: "Bot de teleacceso",
    statusCmd: "pm2 jlist | node -e \"const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d).find(x=>x.name==='teleacceso');console.log(p?p.pm2_env.status:'stopped')\"",
    sizeCmd: "du -sh /opt/botsAR/teleacceso | cut -f1",
  },
  {
    id: "webhook",
    name: "Webhook Server",
    path: "/home/ubuntu/webhook",
    type: "pm2",
    description: "Servidor de webhooks",
    statusCmd: "pm2 jlist | node -e \"const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d).find(x=>x.name==='webhook');console.log(p?p.pm2_env.status:'stopped')\"",
    sizeCmd: "du -sh /home/ubuntu/webhook | cut -f1",
  },
  {
    id: "botmailar",
    name: "Bot Mailar",
    path: "/home/ubuntu/botmailar",
    type: "manual",
    description: "Bot OTP de email",
    statusCmd: "echo 'manual'",
    sizeCmd: "du -sh /home/ubuntu/botmailar | cut -f1",
  },
];

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [diskResult, uptimeResult, memResult] = await Promise.all([
      execAsync("df -h / | tail -1 | awk '{print $2, $3, $4, $5}'"),
      execAsync("uptime -p"),
      execAsync("free -h | grep Mem | awk '{print $2, $3, $4}'"),
    ]);

    const diskParts = diskResult.stdout.trim().split(" ");
    const memParts = memResult.stdout.trim().split(" ");

    const projects = await Promise.all(
      PROJECTS.map(async (p) => {
        try {
          const [statusRes, sizeRes] = await Promise.all([
            execAsync(p.statusCmd).catch(() => ({ stdout: "unknown" })),
            execAsync(p.sizeCmd).catch(() => ({ stdout: "?" })),
          ]);
          return {
            id: p.id,
            name: p.name,
            path: p.path,
            type: p.type,
            domain: (p as any).domain || null,
            description: p.description,
            status: statusRes.stdout.trim() || "stopped",
            size: sizeRes.stdout.trim(),
          };
        } catch {
          return {
            id: p.id,
            name: p.name,
            path: p.path,
            type: p.type,
            domain: (p as any).domain || null,
            description: p.description,
            status: "error",
            size: "?",
          };
        }
      })
    );

    return NextResponse.json({
      server: {
        diskTotal: diskParts[0] || "?",
        diskUsed: diskParts[1] || "?",
        diskFree: diskParts[2] || "?",
        diskPercent: diskParts[3] || "?",
        uptime: uptimeResult.stdout.trim(),
        memTotal: memParts[0] || "?",
        memUsed: memParts[1] || "?",
        memFree: memParts[2] || "?",
      },
      projects,
    });
  } catch (error) {
    console.error("VPS status error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
