// @vitest-environment jsdom
// B-PR8 — BodyEditor: decisión de modo (visual vs Markdown) y toggle.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BodyEditor } from "./body-editor";

afterEach(() => {
  cleanup();
});

describe("BodyEditor", () => {
  it("abre en modo Markdown con aviso ámbar cuando hay HTML crudo", async () => {
    render(
      <BodyEditor value={'<iframe src="https://x.com"></iframe>'} onChange={() => {}} />,
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /no conserva fielmente/i,
      );
    });
    // Textarea (modo Markdown) + toggle hacia el editor visual siempre visible.
    expect(
      screen.getByRole("textbox", { name: /cuerpo del artículo \(markdown\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editor visual/i }),
    ).toBeInTheDocument();
  });

  it("abre en modo visual cuando el roundtrip es seguro y permite volver a Markdown", async () => {
    render(<BodyEditor value={"## Sección\n\nTexto."} onChange={() => {}} />, {});

    // Con roundtrip seguro el toggle ofrece «Ver Markdown» (modo visual).
    const toggle = await screen.findByRole(
      "button",
      { name: /ver markdown/i },
      { timeout: 10000 },
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // Ida y vuelta: el Textarea es fallback permanente.
    fireEvent.click(toggle);
    expect(
      screen.getByRole("textbox", { name: /cuerpo del artículo \(markdown\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editor visual/i }),
    ).toBeInTheDocument();
  });

  it("emite los cambios del modo Markdown por onChange (contrato del form)", async () => {
    const onChange = vi.fn();
    render(<BodyEditor value={"<div>html</div>"} onChange={onChange} />);

    const textarea = await screen.findByRole("textbox", {
      name: /cuerpo del artículo \(markdown\)/i,
    });
    await waitFor(() => expect(textarea).toBeEnabled());
    fireEvent.change(textarea, { target: { value: "## Nuevo" } });
    expect(onChange).toHaveBeenCalledWith("## Nuevo");
  });
});
