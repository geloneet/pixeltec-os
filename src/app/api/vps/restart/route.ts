import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const RESTART_COMMANDS: Record<string, string> = {
  "pixeltec-os": "cd /home/ubuntu/pixeltec-os && docker compose restart",
  "pipas-tondoroque": "docker restart pipas-container",
  "viva-bot": "pm2 restart viva-bot",
  "teleacceso": "pm2 restart teleacceso",
  "webhook": "pm2 restart webhook",
};

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await req.json();
    if (!projectId || !RESTART_COMMANDS[projectId]) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    const { stdout } = await execAsync(RESTART_COMMANDS[projectId], {
      timeout: 30000,
    });

    return NextResponse.json({ success: true, output: stdout.trim() });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message?.slice(-300),
    }, { status: 500 });
  }
}
