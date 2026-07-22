import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { touchHeartbeat } from "./heartbeat";

let dir: string | null = null;

afterEach(() => {
  if (dir) {
    rmSync(dir, { recursive: true, force: true });
    dir = null;
  }
});

describe("touchHeartbeat", () => {
  it("escribe un timestamp ISO fresco en la ruta indicada", () => {
    dir = mkdtempSync(join(tmpdir(), "qa-heartbeat-"));
    const path = join(dir, "heartbeat");

    const before = Date.now();
    touchHeartbeat(path);

    const written = readFileSync(path, "utf8");
    const parsed = Date.parse(written);
    expect(Number.isNaN(parsed)).toBe(false);
    expect(parsed).toBeGreaterThanOrEqual(before - 1000);
    expect(parsed).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("jamás lanza aunque la ruta no sea escribible (best-effort)", () => {
    expect(() => touchHeartbeat("/ruta/que/no/existe/heartbeat")).not.toThrow();
  });
});
