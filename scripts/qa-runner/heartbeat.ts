/**
 * Heartbeat del qa-runner (cierre F8) — el loop toca este archivo en cada
 * iteración de poll y el healthcheck de compose verifica su frescura. Sin
 * puerto expuesto, "proceso vivo" no dice nada útil (si el proceso muere el
 * contenedor sale solo y `restart` lo levanta): lo que el healthcheck debe
 * detectar es un loop COLGADO — proceso vivo que dejó de reclamar jobs.
 *
 * El umbral de frescura del healthcheck debe ser MAYOR que `JOB_TIMEOUT_MS`
 * (4 min, `index.ts`): durante un job legítimo el loop no itera y el
 * heartbeat envejece hasta ~4.5 min sin que eso sea un cuelgue.
 *
 * Best-effort a propósito: un fallo de escritura jamás tumba el loop (el
 * healthcheck lo reportará como unhealthy, que es exactamente la señal).
 */
import { writeFileSync } from "node:fs";

export const HEARTBEAT_PATH = "/tmp/qa-runner-heartbeat";

export function touchHeartbeat(path: string = HEARTBEAT_PATH): void {
  try {
    writeFileSync(path, new Date().toISOString());
  } catch {
    // best-effort: sin heartbeat el healthcheck marca unhealthy — señal correcta.
  }
}
