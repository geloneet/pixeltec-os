# Video 1 — whatsapp_business_messaging (guion)

Un solo video para este permiso. 1080p, cursor visible, sin cortes en los pasos 3–6. Rótulos en inglés (la UI está en español). Duración objetivo: 90–150 s. Grabar la pantalla del CRM y, en una ventana o teléfono visible, el WhatsApp del «cliente» (un número de prueba de PixelTEC).

| # | En pantalla | Rótulo (EN) |
|---|---|---|
| 1 | `https://pixeltec.mx/login` vacío → escribir correo y contraseña de la cuenta `meta-review@` → Entrar | "1/6 Log in to Pixeltec.mx CRM" |
| 2 | Aterrizaje en `/whatsapp`, pestaña **Bandeja** con conversaciones | "2/6 WhatsApp Inbox – conversations received via Cloud API webhook" |
| 3 | Desde el teléfono del cliente, enviar «Hola, quiero información» al número de negocio; la conversación aparece / sube en la Bandeja | "3/6 Customer sends a WhatsApp message to the business number" |
| 4 | Abrir la conversación → **Tomar control** (el bot se pausa; banner «Control humano activo») | "4/6 Agent takes over the conversation" |
| 5 | Escribir «Hi! Thanks for reaching out, this reply is sent from our CRM.» → **Enviar**; la burbuja aparece con estado enviado/entregado | "5/6 Reply sent with POST /{phone-number-id}/messages" |
| 6 | El teléfono del cliente muestra el mensaje recibido en WhatsApp | "6/6 Message received on the customer's WhatsApp" |

Cierre: 2 s sobre la Bandeja mostrando los estados ✓✓. No mostrar la pestaña Cuenta en este video (ese es el video 2).
