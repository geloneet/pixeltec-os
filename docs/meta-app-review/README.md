# Meta App Review — kit de envío (WO-2026-00181)

Kit para (re)enviar o responder el App Review de la app **PixelTEC BOT** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Todo lo que el revisor prueba vive en `https://pixeltec.mx/whatsapp` con la cuenta de rol `reviewer` (`meta-review@pixeltec.mx`, congelada; la contraseña **nunca** se escribe en este repo ni en NeuroPIXEL: se pega una sola vez en el formulario de Meta).

| Archivo | Qué es | Dónde se pega en Meta |
|---|---|---|
| `use-case-messaging.md` | Texto EN del caso de uso de `whatsapp_business_messaging` | App Review → permiso → «Tell us how you'll use this permission» |
| `use-case-management.md` | Texto EN del caso de uso de `whatsapp_business_management` | Ídem |
| `screencast-messaging.md` | Guion del video 1 (un video por permiso) | Upload del permiso de mensajería |
| `screencast-management.md` | Guion del video 2 | Upload del permiso de gestión |
| `reviewer-instructions.md` | Instrucciones EN para el revisor (plantilla sin secretos) | «Provide testing instructions» del envío |

## Checklist previo al envío (todo en Meta App Dashboard, lo hace Miguel)

- [ ] **Privacy Policy URL** = `https://pixeltec.mx/aviso-de-privacidad` (responde 200, público).
- [ ] **User Data Deletion** = URL `https://pixeltec.mx/data-deletion` (responde 200, público).
- [ ] **App icon** 1024×1024, **Category** (Business and pages / Messaging), **Contact email** vigente, **App name** «PixelTEC BOT» tal como aparece en el CRM.
- [ ] **Business Verification** APPROVED (ya está) y la app enlazada al Business Manager verificado.
- [ ] Permisos solicitados = **solo** `whatsapp_business_messaging` + `whatsapp_business_management` (nada de Facebook/Instagram: Meta rechaza permisos sin uso demostrado).
- [ ] La cuenta `meta-review@pixeltec.mx` entra en `https://pixeltec.mx/login`, aterriza en `/whatsapp` y ve **Bandeja** y **Cuenta** (sin MFA activado en esa cuenta).
- [ ] `WHATSAPP_BUSINESS_ACCOUNT_ID` configurado en producción (sin él la sección Plantillas muestra «No configurado» y el video 2 no se puede grabar).
- [ ] Hay al menos una conversación reciente en la Bandeja y el número de negocio recibe mensajes (el revisor escribirá desde su propio WhatsApp).
- [ ] Videos: **uno por permiso**, 1080p, cursor visible, **login completo** desde la pantalla de acceso (no empezar ya dentro), subtítulos o rótulos en inglés (la UI está en español), sin cortes que oculten el paso clave, ≤ 3 min.
- [ ] Texto y video **cuentan lo mismo**: lo que el video muestra es exactamente lo que dice el caso de uso.

## Por qué esta forma

Meta aprueba cuando (1) el revisor puede reproducir el flujo por sí mismo con la cuenta de prueba, (2) cada permiso tiene su descripción y su video, (3) ningún botón visible falla, y (4) el permiso de gestión se demuestra **creando una plantilla** desde la app. Fuente: documentación oficial de App Review para WhatsApp (developers.facebook.com, leída 2026-09-02) — ver `docs/pr/WO-2026-00181.md` §1.
