// B-PR8 — tests puros de la guardia de roundtrip (sin Tiptap ni DOM).
import { describe, expect, it, vi } from "vitest";
import {
  hasRawHtml,
  markdownRoundtripSafe,
  normalizeMarkdown,
} from "./markdown-roundtrip";
import { ROUNDTRIP_FIXTURES } from "./markdown-roundtrip.fixtures";

describe("hasRawHtml", () => {
  it("detecta bloques HTML (iframe)", () => {
    expect(hasRawHtml('<iframe src="https://x.com"></iframe>')).toBe(true);
  });

  it("detecta etiquetas inline (div, br, img)", () => {
    expect(hasRawHtml('Texto <div class="x">bloque</div>.')).toBe(true);
    expect(hasRawHtml("Línea<br>otra")).toBe(true);
    expect(hasRawHtml('<img src="/a.png" alt="a">')).toBe(true);
  });

  it("detecta etiquetas de cierre sueltas", () => {
    expect(hasRawHtml("texto </div> suelto")).toBe(true);
  });

  it("detecta comentarios HTML", () => {
    expect(hasRawHtml("Texto\n\n<!-- nota -->\n")).toBe(true);
  });

  it("NO marca HTML dentro de fences de código", () => {
    expect(hasRawHtml('```html\n<div class="x">hola</div>\n```')).toBe(false);
  });

  it("NO marca HTML dentro de código inline", () => {
    expect(hasRawHtml("Usa `<div>` para agrupar.")).toBe(false);
  });

  it("NO marca comparaciones ni `<` sueltos", () => {
    expect(hasRawHtml("si a < b entonces")).toBe(false);
    expect(hasRawHtml("me da <3 este blog")).toBe(false);
  });

  it("NO marca autolinks", () => {
    expect(hasRawHtml("Mira <https://example.com> y <mailto:a@b.mx>")).toBe(false);
  });
});

describe("normalizeMarkdown", () => {
  it("R1 — unifica CRLF a LF", () => {
    expect(normalizeMarkdown("a\r\nb\r\nc")).toBe(normalizeMarkdown("a b c"));
  });

  it("R2 — elimina espacios finales y canoniza hard breaks a backslash", () => {
    expect(normalizeMarkdown("hola   ")).toBe("hola");
    expect(normalizeMarkdown("uno  \ndos")).toBe("uno\\\ndos");
    expect(normalizeMarkdown("uno\\\ndos")).toBe("uno\\\ndos");
  });

  it("R3 — colapsa 3+ saltos y recorta extremos", () => {
    expect(normalizeMarkdown("\n\na\n\n\n\nb\n\n")).toBe("a\n\nb");
  });

  it("R4 — canoniza bullets * y + a -", () => {
    expect(normalizeMarkdown("* uno\n+ dos\n- tres")).toBe(
      normalizeMarkdown("- uno\n- dos\n- tres"),
    );
  });

  it("R5 — colapsa espaciado tras marcadores", () => {
    expect(normalizeMarkdown("-   item")).toBe("- item");
    expect(normalizeMarkdown("##   Título  ##")).toBe("## Título");
    expect(normalizeMarkdown(">   cita")).toBe("> cita");
  });

  it("R6 — canoniza `1)` a `1.`", () => {
    expect(normalizeMarkdown("1) uno\n2) dos")).toBe("1. uno\n2. dos");
  });

  it("R7 — canoniza énfasis de guion bajo a asterisco", () => {
    expect(normalizeMarkdown("_cursiva_ y __negrita__")).toBe(
      "*cursiva* y **negrita**",
    );
  });

  it("R7 — no toca snake_case ni guiones bajos interiores", () => {
    expect(normalizeMarkdown("variable snake_case_name aquí")).toBe(
      "variable snake_case_name aquí",
    );
  });

  it("R8 — elimina escapes defensivos sobre puntuación", () => {
    expect(normalizeMarkdown("1\\. no es lista")).toBe("1. no es lista");
    expect(normalizeMarkdown("\\*literal\\*")).toBe("*literal*");
  });

  it("R9 — canoniza padding y delimitadores de tablas", () => {
    expect(normalizeMarkdown("| a   | b |\n|:----|--:|\n|  1  | 2 |")).toBe(
      "| a | b |\n| :--- | ---: |\n| 1 | 2 |",
    );
  });

  it("R10 — pliega soft breaks de párrafos y citas", () => {
    expect(normalizeMarkdown("una frase\npartida")).toBe("una frase partida");
    expect(normalizeMarkdown("> cita\n> partida")).toBe("> cita partida");
  });

  it("R10 — NO pliega hard breaks ni inicios de bloque", () => {
    expect(normalizeMarkdown("uno  \ndos")).toBe("uno\\\ndos");
    expect(normalizeMarkdown("texto\n## título")).toBe("texto\n## título");
    expect(normalizeMarkdown("texto\n- item")).toBe("texto\n- item");
  });

  it("no toca el contenido de fences de código (bullets, énfasis, escapes)", () => {
    const md = "```ts\nconst a = 'x'\n* no soy bullet\n_no_soy_enfasis_\n\\* literal\n```";
    expect(normalizeMarkdown(md)).toBe(md);
  });
});

describe("markdownRoundtripSafe", () => {
  const identity = (md: string) => md;

  it("es seguro con un serializador identidad", () => {
    const verdict = markdownRoundtripSafe("## Hola\n\nTexto.", identity);
    expect(verdict).toEqual({ safe: true });
  });

  it("tolera diferencias de ESTILO (bullets, énfasis, soft breaks)", () => {
    const styleShift = (md: string) =>
      md.replace(/^\* /gm, "- ").replace(/_(\w+)_/g, "*$1*");
    const verdict = markdownRoundtripSafe("* uno con _énfasis_\n* dos", styleShift);
    expect(verdict.safe).toBe(true);
  });

  it("rechaza HTML crudo sin llamar al serializador", () => {
    const spy = vi.fn(identity);
    const verdict = markdownRoundtripSafe("<div>hola</div>", spy);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("HTML crudo");
    expect(spy).not.toHaveBeenCalled();
  });

  it("rechaza cuando el serializador lanza", () => {
    const boom = () => {
      throw new Error("sin DOM");
    };
    const verdict = markdownRoundtripSafe("texto", boom);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("sin DOM");
  });

  it("rechaza mutaciones de CONTENIDO e indica la línea", () => {
    const lossy = (md: string) => md.replace("# Título dentro", "Título dentro");
    const verdict = markdownRoundtripSafe(
      "# Título dentro del cuerpo\n\nTexto.",
      lossy,
    );
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("línea 1");
  });

  it("acepta el documento vacío", () => {
    expect(markdownRoundtripSafe("", identity).safe).toBe(true);
  });
});

describe("fixtures — coherencia interna (sin serializador real)", () => {
  // Con el serializador identidad, TODA fixture sin HTML crudo debe ser segura:
  // los veredictos negativos del corpus vienen del serializador real (jsdom).
  for (const fixture of ROUNDTRIP_FIXTURES) {
    it(`identidad: ${fixture.name}`, () => {
      const verdict = markdownRoundtripSafe(fixture.md, (md) => md);
      expect(verdict.safe).toBe(!hasRawHtml(fixture.md));
    });
  }
});
