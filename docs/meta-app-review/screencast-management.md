# Video 2 — whatsapp_business_management (guion)

Un solo video para este permiso. 1080p, cursor visible, login completo otra vez (Meta revisa cada video por separado). Rótulos en inglés. Duración objetivo: 90–150 s. Requisito previo: `WHATSAPP_BUSINESS_ACCOUNT_ID` configurado en producción.

| # | En pantalla | Rótulo (EN) |
|---|---|---|
| 1 | `https://pixeltec.mx/login` → entrar con `meta-review@` | "1/5 Log in to Pixeltec.mx CRM" |
| 2 | Clic en pestaña **Cuenta** → tarjeta Número (número, nombre verificado, calidad, límite) | "2/5 Phone number read with GET /{phone-number-id}" |
| 3 | Tarjeta Perfil de empresa (about, dirección, correo, sitio web, vertical) | "3/5 Business profile read with GET /{phone-number-id}/whatsapp_business_profile" |
| 4 | Sección Plantillas: lista con estados (Aprobada / En revisión / Rechazada) | "4/5 Message templates listed with GET /{waba-id}/message_templates" |
| 5 | **Nueva plantilla** → nombre `seguimiento_cotizacion_demo`, idioma es_MX, categoría UTILITY, cuerpo «Hola {{1}}, te compartimos el seguimiento de tu cotización {{2}}.», ejemplos «Ana» / «COT-1042» → **Crear**; toast y la plantilla aparece en la lista como «En revisión» | "5/5 Template created with POST /{waba-id}/message_templates – status Pending" |

Después de grabar, la plantilla de prueba se puede borrar desde WhatsApp Manager (no desde la app, a propósito).
