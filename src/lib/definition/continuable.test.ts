import { describe, expect, it } from "vitest";
import { pickContinuableDefinition } from "./continuable";

function def(id: string, status: "draft" | "in_progress" | "completed", updatedAt: string) {
  return { id, status, updatedAt: new Date(updatedAt) };
}

describe("pickContinuableDefinition", () => {
  it("devuelve null si la lista está vacía", () => {
    expect(pickContinuableDefinition([])).toBeNull();
  });

  it("devuelve null si todas están completed", () => {
    const list = [def("a", "completed", "2026-07-01"), def("b", "completed", "2026-07-10")];
    expect(pickContinuableDefinition(list)).toBeNull();
  });

  it("devuelve la única definición sin terminar", () => {
    const list = [def("a", "completed", "2026-07-01"), def("b", "draft", "2026-07-05")];
    expect(pickContinuableDefinition(list)?.id).toBe("b");
  });

  it("con varias sin terminar, devuelve la de updatedAt más reciente", () => {
    const list = [
      def("a", "in_progress", "2026-07-01"),
      def("b", "draft", "2026-07-10"),
      def("c", "in_progress", "2026-07-05"),
    ];
    expect(pickContinuableDefinition(list)?.id).toBe("b");
  });
});
