<!-- 
  BORRADOR — NO PUBLICAR
  Versión: 2.0 draft
  Fecha de elaboración: Mayo 2026
  Pendiente: revisión legal externa antes de sustituir /aviso-de-privacidad
  Cambios respecto a v1 (Julio 2024):
    - Actualización de proveedor de hosting: OVH SAS (antes decía "Vercel o AWS")
    - Nuevo proveedor de email transaccional: Resend, Inc.
    - Nueva finalidad de tratamiento: seguridad y prevención de fraude (registro de IP y User-Agent)
    - Nuevas colecciones Firestore mencionadas: portalSecurityEvents, portalRateLimit
    - Cookies actualizadas: __portal_session (nueva) y __session (admin)
    - Periodo de retención de datos de seguridad: 90 días
    - Corrección de domicilio/país: México (se omitía en v1)
-->

# AVISO DE PRIVACIDAD INTEGRAL

**Responsable:** PixelTEC  
**Última actualización:** Mayo 2026

---

## I. Identidad y Domicilio del Responsable

**PixelTEC** (en adelante "el Responsable"), con domicilio en Puerto Vallarta, Jalisco, México, es responsable del tratamiento de los datos personales que usted nos proporciona.

Para cualquier asunto relacionado con la protección de sus datos personales, puede contactarnos en:  
**Correo electrónico:** contacto@pixeltec.mx

---

## II. Datos Personales que Tratamos

Tratamos las siguientes categorías de datos personales:

### Datos de identificación y contacto
- Nombre completo
- Correo electrónico
- Número de teléfono
- Nombre de la empresa o razón social

### Datos laborales y de proyecto
- Información sobre proyectos contratados, sus avances y actualizaciones
- Servicios activos
- Historial de actividad en el portal de clientes

### Datos de facturación
- Información necesaria para la emisión de facturas (en su caso)

### Datos técnicos de seguridad *(tratamiento nuevo a partir de Mayo 2026)*
- **Dirección IP**: registrada automáticamente durante el uso del portal de clientes y en solicitudes de código de acceso (OTP)
- **User-Agent (identificador del navegador/dispositivo)**: registrado automáticamente durante el uso del portal de clientes
- **Identificador de portal (slug)**: segmento público de URL correspondiente al acceso de cada cliente

> **Nota:** Los datos técnicos de seguridad NO incluyen el código OTP, contraseñas, tokens de sesión ni ningún identificador interno sensible. Se registra únicamente información de red y dispositivo estrictamente necesaria para los fines de seguridad descritos a continuación.

PixelTEC **no recaba datos personales sensibles** en el sentido del artículo 3, fracción VI de la LFPDPPP.

---

## III. Finalidades del Tratamiento

### Finalidades primarias (necesarias para la relación jurídica)

1. **Prestación de servicios contratados**: gestión, seguimiento y entrega de proyectos de desarrollo de software, sitios web y servicios digitales.
2. **Comunicación con el cliente**: envío de notificaciones sobre avances, actualizaciones y requerimientos del proyecto.
3. **Acceso al portal de clientes**: autenticación mediante código de un solo uso (OTP) enviado al correo electrónico registrado, y mantenimiento de la sesión activa del portal.
4. **Facturación y cobranza**: emisión de comprobantes fiscales y gestión de pagos.
5. **Atención a solicitudes de soporte**: respuesta a consultas, incidencias o solicitudes relacionadas con los servicios contratados.

### Finalidades secundarias (puede oponerse en cualquier momento)

6. **Envío de información comercial y actualizaciones**: comunicaciones sobre nuevos servicios, mejoras o información de interés relacionada con PixelTEC. Puede revocar su consentimiento en cualquier momento escribiendo a contacto@pixeltec.mx con el asunto "Baja de comunicaciones".

### Finalidades de seguridad *(nuevas a partir de Mayo 2026)*

7. **Prevención de fraude y abuso del portal**: registro de intentos fallidos de autenticación, detección de accesos no autorizados y bloqueo temporal de solicitudes excesivas desde una misma dirección IP (límite de 10 solicitudes por hora).
8. **Auditoría de seguridad**: generación de registros de eventos de seguridad para identificar patrones de abuso, intentos de suplantación de identidad y actividad anómala en el portal de clientes.
9. **Integridad y disponibilidad del servicio**: protección de la infraestructura técnica frente a ataques automatizados.

Los datos técnicos de seguridad (IP, User-Agent) se utilizan **exclusivamente** para las finalidades 7, 8 y 9. No se utilizan para elaborar perfiles de usuario, publicidad ni toma de decisiones automatizadas con efectos jurídicos o significativos.

---

## IV. Transferencias de Datos a Terceros

Para el cumplimiento de las finalidades descritas, sus datos personales pueden ser transmitidos a los siguientes terceros:

| Tercero | País | Finalidad | Base legal |
|---------|------|-----------|-----------|
| **Google LLC** (Firebase / Firestore) | Estados Unidos | Almacenamiento de datos del portal, sesiones, eventos de seguridad y registros de actividad. | Necesaria para la relación jurídica (Art. 37, fracc. I, LFPDPPP) |
| **OVH SAS** | Francia | Hospedaje y procesamiento del servidor de la aplicación web. | Necesaria para la relación jurídica (Art. 37, fracc. I, LFPDPPP) |
| **Resend, Inc.** | Estados Unidos | Envío de correos electrónicos transaccionales (códigos OTP, notificaciones de proyecto). | Necesaria para la relación jurídica (Art. 37, fracc. I, LFPDPPP) |

> **Retención de datos por terceros:** PixelTEC configura una política de retención de 90 días para los registros de eventos de seguridad almacenados en Firestore. Los demás datos se conservan por el tiempo necesario para cumplir con las finalidades descritas o mientras subsista la relación contractual.

No realizamos transferencias de datos personales con fines comerciales a terceros no mencionados en esta tabla sin su consentimiento previo.

---

## V. Periodo de Conservación

| Categoría de datos | Periodo de conservación |
|--------------------|------------------------|
| Datos de identificación y contacto | Mientras subsista la relación contractual + 5 años (obligaciones fiscales) |
| Datos de proyecto y servicios | Mientras subsista la relación contractual + 1 año |
| Datos de facturación | 5 años a partir de la emisión del comprobante (SAT) |
| Eventos de seguridad (IP, User-Agent) | **90 días** a partir del registro |
| Registros de límite de solicitudes OTP (IP) | **90 días** a partir del último registro |
| Sesión de portal (`__portal_session`) | 7 días desde el último acceso (renovación automática por actividad) |

---

## VI. Cookies y Tecnologías de Rastreo

El portal de clientes utiliza las siguientes cookies:

| Cookie | Tipo | Propósito | Duración |
|--------|------|-----------|----------|
| `__portal_session` | Técnica / httpOnly | Mantiene la sesión autenticada del portal de clientes tras la verificación OTP. Firmada criptográficamente en el servidor. No accesible desde JavaScript. | 7 días (renovación automática por actividad) |
| `__session` | Técnica / httpOnly | Sesión autenticada del panel administrativo de PixelTEC (solo personal autorizado). Gestionada por Firebase Authentication. | Según configuración de Firebase |

> Actualmente no utilizamos cookies de publicidad, análisis de comportamiento ni rastreo entre sitios. Si en el futuro incorporamos dichas tecnologías, actualizaremos este aviso con antelación.

---

## VII. Derechos ARCO

Usted tiene derecho a **Acceder, Rectificar, Cancelar u Oponerse** al tratamiento de sus datos personales (derechos ARCO), conforme a lo establecido en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).

### Procedimiento para ejercer sus derechos ARCO

1. Envíe un correo electrónico a **contacto@pixeltec.mx** con el asunto: **"Solicitud ARCO"**
2. Incluya en su solicitud:
   - Nombre completo y correo electrónico registrado con PixelTEC
   - Descripción clara del derecho que desea ejercer (Acceso, Rectificación, Cancelación u Oposición)
   - En caso de Rectificación: los datos incorrectos y su corrección
   - En caso de Oposición: las finalidades específicas respecto de las cuales se opone
3. Le responderemos en un plazo máximo de **20 días hábiles** contados a partir de la recepción de su solicitud, conforme al artículo 32 de la LFPDPPP.
4. Si su solicitud procede, los cambios se harán efectivos en un plazo de **15 días hábiles** adicionales.

> Los plazos anteriores pueden ser ampliados por una sola vez por un periodo igual, cuando lo justifiquen las circunstancias del caso.

---

## VIII. Revocación del Consentimiento

Usted puede revocar en cualquier momento el consentimiento otorgado para el tratamiento de sus datos personales para las **finalidades secundarias** (finalidad 6: comunicaciones comerciales), escribiendo a contacto@pixeltec.mx con el asunto "Revocación de consentimiento".

> Tenga en cuenta que la revocación del consentimiento no tiene efectos retroactivos y puede limitar nuestra capacidad para prestar ciertos servicios o mantener la relación contractual activa.

---

## IX. Seguridad de los Datos

PixelTEC implementa medidas técnicas y organizativas para proteger sus datos personales contra acceso no autorizado, pérdida o divulgación, incluyendo:

- Transmisión cifrada (HTTPS/TLS) en todas las comunicaciones
- Cookies de sesión firmadas criptográficamente (HMAC-SHA256) y marcadas como `httpOnly` y `Secure`
- Acceso restringido a datos del portal: cada cliente accede únicamente a su propia información mediante token verificado en el servidor
- Registro de eventos de seguridad para detección de accesos no autorizados

---

## X. Cambios al Aviso de Privacidad

PixelTEC se reserva el derecho de actualizar este aviso de privacidad. En caso de cambios sustanciales, le notificaremos por correo electrónico al registrado en nuestra base de datos o mediante un aviso visible en el portal. La versión vigente estará siempre disponible en **pixeltec.mx/aviso-de-privacidad**.

---

## XI. Autoridad de Control

Si considera que su derecho a la protección de datos personales ha sido vulnerado, puede acudir ante el **Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI)**, con domicilio en Insurgentes Sur 3211, Col. Insurgentes Cuicuilco, Alcaldía Coyoacán, C.P. 04530, Ciudad de México, o a través de su sitio web: **www.inai.org.mx**.

---

*Aviso de Privacidad elaborado conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad publicados por el INAI.*
