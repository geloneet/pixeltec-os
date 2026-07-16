import { describe, expect, it } from "vitest";
import { extractSignals } from "./extract";

describe("extractSignals", () => {
  it("extrae título, descripción, headings, colores y fuentes de un HTML típico", () => {
    const html = `
      <html>
        <head>
          <title>Mi Sitio &amp; Más</title>
          <meta name="description" content="Una descripción &quot;con comillas&quot; y &lt;tags&gt;">
          <style>
            body { color: #ff0000; background-color: rgb(10, 20, 30); font-family: "Helvetica Neue", sans-serif; }
            h1 { color: #00FF00; }
          </style>
        </head>
        <body>
          <h1>Título <b>principal</b></h1>
          <h2 style="color: #123456; font-family: Georgia, serif;">Subtítulo</h2>
          <h3>Otro heading</h3>
          <p>Contenido normal, no es heading.</p>
          <script>document.write("<h1>inyectado por script</h1>");</script>
        </body>
      </html>
    `;

    const signals = extractSignals(html, "https://ejemplo.com/");

    expect(signals.title).toBe("Mi Sitio & Más");
    expect(signals.description).toBe('Una descripción "con comillas" y <tags>');
    expect(signals.headings).toEqual(["Título principal", "Subtítulo", "Otro heading"]);
    expect(signals.headings).not.toContain("inyectado por script");
    expect(signals.colors).toEqual(
      expect.arrayContaining(["#ff0000", "rgb(10, 20, 30)", "#00FF00", "#123456"]),
    );
    expect(signals.fonts).toEqual(
      expect.arrayContaining(["Helvetica Neue", "sans-serif", "Georgia", "serif"]),
    );
  });

  it("devuelve title null cuando no hay <title>", () => {
    const signals = extractSignals("<html><body><p>sin título</p></body></html>", "https://ejemplo.com/");
    expect(signals.title).toBeNull();
  });

  it("devuelve description null cuando no hay meta description", () => {
    const signals = extractSignals("<html><head><title>T</title></head><body></body></html>", "https://ejemplo.com/");
    expect(signals.description).toBeNull();
  });

  it("trunca title a 200 caracteres", () => {
    const largo = "x".repeat(500);
    const signals = extractSignals(`<title>${largo}</title>`, "https://ejemplo.com/");
    expect(signals.title).not.toBeNull();
    expect(signals.title!.length).toBe(200);
  });

  it("trunca description a 300 caracteres", () => {
    const largo = "y".repeat(500);
    const signals = extractSignals(
      `<meta name="description" content="${largo}">`,
      "https://ejemplo.com/",
    );
    expect(signals.description).not.toBeNull();
    expect(signals.description!.length).toBe(300);
  });

  it("limita headings a 20 y trunca cada uno a 120 caracteres", () => {
    const headingsHtml = Array.from({ length: 30 }, (_, i) => `<h2>Heading número ${i} ${"z".repeat(150)}</h2>`).join(
      "\n",
    );
    const signals = extractSignals(headingsHtml, "https://ejemplo.com/");
    expect(signals.headings.length).toBe(20);
    for (const h of signals.headings) {
      expect(h.length).toBeLessThanOrEqual(120);
    }
  });

  it("limita colores a 40 y son únicos", () => {
    const style = `<style>${Array.from({ length: 60 }, (_, i) => `.c${i}{color:#${(i % 16).toString(16).repeat(6)};}`).join(
      "\n",
    )}</style>`;
    const signals = extractSignals(style, "https://ejemplo.com/");
    expect(signals.colors.length).toBeLessThanOrEqual(40);
    expect(new Set(signals.colors).size).toBe(signals.colors.length);
  });

  it("limita fuentes a 20 y son únicas", () => {
    const style = `<style>${Array.from({ length: 30 }, (_, i) => `.f${i}{font-family:"Font${i}", sans-serif;}`).join(
      "\n",
    )}</style>`;
    const signals = extractSignals(style, "https://ejemplo.com/");
    expect(signals.fonts.length).toBeLessThanOrEqual(20);
    expect(new Set(signals.fonts).size).toBe(signals.fonts.length);
  });

  it("no filtra contenido crudo de <script> ni <style> en headings/título/descripción", () => {
    const html = `
      <script>var secret = "no debe aparecer en señales";</script>
      <title>Título limpio</title>
      <h1>Heading limpio</h1>
    `;
    const signals = extractSignals(html, "https://ejemplo.com/");
    expect(signals.title).toBe("Título limpio");
    expect(signals.headings).toEqual(["Heading limpio"]);
    expect(JSON.stringify(signals)).not.toContain("secret");
  });

  it("nunca retorna ni contiene el HTML crudo completo", () => {
    const html = `<html><head><title>T</title></head><body><h1>H</h1><p>parrafo no capturado</p></body></html>`;
    const signals = extractSignals(html, "https://ejemplo.com/");
    const serialized = JSON.stringify(signals);
    expect(serialized).not.toContain("<html>");
    expect(serialized).not.toContain("parrafo no capturado");
  });

  it("extrae colores y fuentes de style inline además de <style>", () => {
    const html = `<div style="color: #abcdef; font-family: 'Comic Sans MS', cursive;">hola</div>`;
    const signals = extractSignals(html, "https://ejemplo.com/");
    expect(signals.colors).toContain("#abcdef");
    expect(signals.fonts).toEqual(expect.arrayContaining(["Comic Sans MS", "cursive"]));
  });
});
