import { describe, it, expect } from "vitest";
import { renderPasswordChangedEmail } from "./PasswordChangedEmail";

/**
 * Aviso de cambio de contraseña (C-PR2). Fija: escape del nombre (input
 * controlado por el usuario vía su perfil), fecha es-MX en zona
 * America/Mexico_City y CTA hacia /login.
 */
describe("renderPasswordChangedEmail", () => {
  const baseProps = {
    name: "Miguel",
    changedAt: new Date("2026-08-05T18:30:00Z"), // 12:30 en America/Mexico_City
    loginUrl: "https://pixeltec.mx/login",
  };

  it("incluye saludo, fecha es-MX y enlace a /login", () => {
    const html = renderPasswordChangedEmail(baseProps);

    expect(html).toContain("Hola, Miguel");
    expect(html).toContain("agosto");
    expect(html).toContain("2026");
    expect(html).toContain('href="https://pixeltec.mx/login"');
    expect(html).toContain("rest&aacute;blecela ahora");
  });

  it("escapa HTML en el nombre", () => {
    const html = renderPasswordChangedEmail({ ...baseProps, name: '<img src=x onerror="1">' });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain("&lt;img");
  });
});
