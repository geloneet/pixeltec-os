import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Solo proyectos PM2 pueden ver logs — hardcoded por seguridad
const LOG_COMMANDS: Record<string, string> = {
  "viva-bot": "pm2 logs viva-bot --nostream --lines 10 2>&1 | tail -10",
  "teleacceso": "pm2 logs teleacceso --nostream --lines 10 2>&1 | tail -10",
  "webhook": "pm2 logs webhook --nostream --lines 10 2>&1 | tail -10",
};

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("project");

  if (!projectId || !LOG_COMMANDS[projectId]) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  try {
    const { stdout } = await execAsync(LOG_COMMANDS[projectId], {
      timeout: 10000,
    });

    return NextResponse.json({
      success: true,
      projectId,
      logs: stdout.trim() || "Sin logs recientes",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      logs: error.message?.slice(-500) || "Error al obtener logs",
    }, { status: 500 });
  }
}
