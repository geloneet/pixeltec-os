"use client";

/**
 * PreviewFrame (F6A) — superficie de revisión visual del gate: embebe la ruta
 * `/proyectos/pixelforge/<id>/preview` en un <iframe> same-origin y deja
 * alternar el ancho de dispositivo (Desktop/Tablet/Móvil). El iframe se renderiza
 * al ancho REAL del dispositivo y se escala con `transform: scale()` para caber
 * en el contenedor (wrapper `overflow-hidden`, alto fijo), de modo que el layout
 * responsive de la landing se ve tal cual a cada ancho.
 *
 * El par CSP embedder/embebido se ejercita e2e aquí: esta página (bajo
 * `/proyectos/pixelforge`) obtiene `frame-src 'self'`; la ruta preview obtiene
 * `frame-ancestors 'self'` (ver `@/lib/security/csp`).
 */
import { useEffect, useRef, useState } from "react";
import { Monitor, Tablet, Smartphone, ExternalLink } from "lucide-react";

interface Device {
  id: "desktop" | "tablet" | "mobile";
  label: string;
  width: number;
  Icon: typeof Monitor;
}

const DEVICES: readonly Device[] = [
  { id: "desktop", label: "Desktop", width: 1280, Icon: Monitor },
  { id: "tablet", label: "Tablet", width: 768, Icon: Tablet },
  { id: "mobile", label: "Móvil", width: 390, Icon: Smartphone },
];

interface Props {
  projectId: string;
}

export function PreviewFrame({ projectId }: Props) {
  const [deviceId, setDeviceId] = useState<Device["id"]>("desktop");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const device = DEVICES.find((d) => d.id === deviceId) ?? DEVICES[0];
  const previewSrc = `/proyectos/pixelforge/${projectId}/preview`;

  // Mide el contenedor para calcular el factor de escala. ResizeObserver no
  // existe en jsdom (tests) — el guard evita romper; el ancho del iframe no
  // depende de la medición, solo el `scale`.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nunca ampliamos por encima de 1: si el dispositivo cabe, se ve a escala real.
  const scale = box.width > 0 ? Math.min(1, box.width / device.width) : 1;
  // Alto del iframe SIN escalar, para que tras el scale ocupe todo el alto visible.
  const frameHeight = scale > 0 ? box.height / scale : box.height;

  return (
    <div className="w-full">
      {/* Controles */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Ancho de dispositivo"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1"
        >
          {DEVICES.map(({ id, label, Icon }) => {
            const active = id === deviceId;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDeviceId(id)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        <a
          href={previewSrc}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir en pestaña
        </a>
      </div>

      {/* Marco: contenedor recortado, iframe escalado y centrado */}
      <div
        ref={wrapperRef}
        className="flex h-[70vh] w-full justify-center overflow-hidden rounded-xl border border-border bg-white"
      >
        <iframe
          key={device.id}
          src={previewSrc}
          title="Vista previa de la landing"
          style={{
            width: device.width,
            height: frameHeight,
            border: "0",
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            flex: "0 0 auto",
          }}
        />
      </div>
    </div>
  );
}
