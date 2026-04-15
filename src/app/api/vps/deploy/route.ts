import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// DEPLOY COMMANDS — hardcoded por seguridad. NUNCA aceptar comandos del frontend.
const DEPLOY_COMMANDS: Record<string, string> = {
  "pixeltec-os": "cd /home/ubuntu/pixeltec-os && git pull origin main && docker compose down && docker compose build --no-cache && docker compose up -d",
  "pipas-tondoroque": "bash /home/ubuntu/deploy-pipas.sh",
  "viva-bot": "cd /opt/botsAR/VivaaerobusChk && git pull origin main 2>/dev/null; pm2 restart viva-bot",
  "teleacceso": "cd /opt/botsAR/teleacceso && git pull origin main 2>/dev/null; pm2 restart teleacceso",
  "webhook": "cd /home/ubuntu/webhook && pm2 restart webhook",
  "botmailar": "echo 'Manual project - no auto deploy'",
};

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { projectId } = await req.json();

    if (!projectId || !DEPLOY_COMMANDS[projectId]) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }

    const command = DEPLOY_COMMANDS[projectId];

    const { stdout, stderr } = await execAsync(command, {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 5,
    });

    return NextResponse.json({
      success: true,
      projectId,
      output: stdout.slice(-2000),
      errors: stderr.slice(-1000),
    });
  } catch (error: any) {
    console.error("Deploy error:", error);
    return NextResponse.json({
      success: false,
      error: error.message?.slice(-500) || "Deploy failed",
    }, { status: 500 });
  }
}
