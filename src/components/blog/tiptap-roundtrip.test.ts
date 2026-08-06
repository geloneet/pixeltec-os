// @vitest-environment jsdom
// B-PR8 — roundtrip REAL: Markdown → Tiptap (ProseMirror) → Markdown con las
// mismas extensiones que usa el editor visual, verificado contra la guardia.
import { describe, expect, it } from "vitest";
import { markdownRoundtripSafe } from "@/lib/blog/markdown-roundtrip";
import { ROUNDTRIP_FIXTURES } from "@/lib/blog/markdown-roundtrip.fixtures";
import { serializeThroughTiptap } from "./tiptap-roundtrip";

describe("markdownRoundtripSafe con el serializador real de Tiptap", () => {
  for (const fixture of ROUNDTRIP_FIXTURES) {
    it(`${fixture.expectSafe ? "seguro" : "NO seguro"}: ${fixture.name}`, () => {
      const verdict = markdownRoundtripSafe(fixture.md, serializeThroughTiptap);
      expect(verdict.safe, verdict.reason ?? "").toBe(fixture.expectSafe);
    });
  }

  it("la serialización es idempotente (2º viaje = 1º viaje)", () => {
    for (const fixture of ROUNDTRIP_FIXTURES) {
      if (!fixture.expectSafe) continue;
      const first = serializeThroughTiptap(fixture.md);
      const second = serializeThroughTiptap(first);
      expect(second, fixture.name).toBe(first);
    }
  });
});
