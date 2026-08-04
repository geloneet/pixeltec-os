'use client';

import { useId } from 'react';

/**
 * Patrón decorativo tipo "fondo de pantalla de WhatsApp": iconos de línea
 * dispersos y repetidos en mosaico, a muy baja opacidad, detrás de los
 * globos de la conversación demo. Puramente decorativo (aria-hidden).
 */
export function PixelbotChatWallpaper({ className }: { className?: string }) {
  const uid = useId();
  const patternId = `pixelbot-wallpaper-${uid}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={patternId} width="240" height="240" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            {/* corazón */}
            <g transform="translate(18,24) rotate(-8) scale(0.8)">
              <path d="M12 20s-6-3.8-8-7.2C2.3 9.6 3.5 6 7 6c2 0 3.6 1.4 5 3 1.4-1.6 3-3 5-3 3.5 0 4.7 3.6 3 6.8C18 16.2 12 20 12 20Z" />
            </g>
            {/* estrella */}
            <g transform="translate(150,20) rotate(10) scale(0.7)">
              <path d="M12 2l2.9 6.9L22 9.6l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.6L2 9.6l7.1-0.7L12 2Z" />
            </g>
            {/* globo de chat */}
            <g transform="translate(70,55) rotate(6) scale(0.75)">
              <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            </g>
            {/* palomitas de leído (doble check) */}
            <g transform="translate(190,90) rotate(-4) scale(0.8)">
              <path d="M2 12l4 4L14 8" />
              <path d="M8 12l4 4L20 8" />
            </g>
            {/* reloj */}
            <g transform="translate(30,100) rotate(-12) scale(0.7)">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </g>
            {/* nota musical */}
            <g transform="translate(120,110) rotate(14) scale(0.7)">
              <path d="M9 18V5l11-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="17" cy="16" r="3" />
            </g>
            {/* cámara */}
            <g transform="translate(200,150) rotate(-6) scale(0.72)">
              <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
              <circle cx="12" cy="13" r="3.2" />
            </g>
            {/* carita sonriente */}
            <g transform="translate(40,160) rotate(8) scale(0.75)">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M8.5 9h.01" />
              <path d="M15.5 9h.01" />
            </g>
            {/* avioncito de papel (enviar) */}
            <g transform="translate(110,190) rotate(-10) scale(0.72)">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9 22 2Z" />
            </g>
            {/* micrófono (nota de voz) */}
            <g transform="translate(180,215) rotate(6) scale(0.7)">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </g>
            {/* estrella pequeña extra para densidad */}
            <g transform="translate(220,45) rotate(20) scale(0.4)">
              <path d="M12 2l2.9 6.9L22 9.6l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.6L2 9.6l7.1-0.7L12 2Z" />
            </g>
            {/* corazón pequeño extra */}
            <g transform="translate(85,220) rotate(4) scale(0.45)">
              <path d="M12 20s-6-3.8-8-7.2C2.3 9.6 3.5 6 7 6c2 0 3.6 1.4 5 3 1.4-1.6 3-3 5-3 3.5 0 4.7 3.6 3 6.8C18 16.2 12 20 12 20Z" />
            </g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
