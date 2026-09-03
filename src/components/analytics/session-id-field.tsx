'use client';

import { useEffect, useState } from 'react';
import { SESSION_FIELD_NAME, getTrackingSessionId } from '@/lib/analytics/session';

/**
 * Campo oculto con el id de sesión de contenido (WO-2026-00214).
 *
 * Es lo que permite unir un lead con el rastro de `content_events` de esa misma
 * visita: sin él, sabríamos que alguien leyó tres artículos y que alguien envió
 * un formulario, pero no que fue la misma persona.
 *
 * El valor se rellena en un efecto, no en el render inicial: `sessionStorage`
 * no existe en el servidor y leerlo durante el render provocaría un mismatch de
 * hidratación. `FormData` lee el DOM en el momento del submit, así que para
 * cuando alguien envía el formulario el valor ya está puesto.
 *
 * Si el navegador no tiene storage (modo privado estricto), el campo va vacío y
 * el lead se guarda sin sesión. Nunca es un error visible.
 */
export function SessionIdField() {
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    setSessionId(getTrackingSessionId() ?? '');
  }, []);

  return <input type="hidden" name={SESSION_FIELD_NAME} value={sessionId} readOnly />;
}
