'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SCENE, SceneFrame } from './scene-frame';
import {
  at,
  typeChars,
  typeWords,
  useSceneActive,
  useSceneClock,
  useSceneTimeline,
  type TimelineStep,
} from './use-scene-timeline';

/**
 * WO-2026-00275 · Servicio "Automatización con IA".
 *
 * Dirección: un WhatsAgent trabajando AHORA. A la izquierda el chat del
 * negocio; a la derecha el runtime del agente. Cada mensaje del cliente
 * dispara, a la vista, lo que un agente real hace: detecta la intención,
 * arma una llamada a herramienta carácter a carácter, recibe el resultado
 * (código + latencia) y con eso redacta la respuesta palabra a palabra. La
 * conversación termina con una tarjeta (cita, orden, visita) y el runtime
 * marca "resuelto · sin handoff". Tres negocios distintos rotan para que
 * nunca se lea como un loop de dos segundos.
 */

type Bubble = {
  id: string;
  from: 'cliente' | 'agente';
  text: string;
  card?: { title: string; sub: string };
};

type ConsoleLine = {
  id: string;
  kind: 'intent' | 'call' | 'result' | 'ok';
  text: string;
  typing?: boolean;
};

type State = {
  bubbles: Bubble[];
  typing: boolean;
  typingBubble: string | null;
  lines: ConsoleLine[];
  done: boolean;
};

const EMPTY: State = { bubbles: [], typing: false, typingBubble: null, lines: [], done: false };

type Turn =
  | { kind: 'client'; text: string }
  | { kind: 'intent'; label: string; conf: string }
  | { kind: 'call'; fn: string; result: string }
  | { kind: 'agent'; text: string; card?: { title: string; sub: string } }
  | { kind: 'ok'; text: string };

type Conversation = { business: string; initials: string; turns: Turn[] };

const CONVERSATIONS: Conversation[] = [
  {
    business: 'Clínica Dental Sonrisa',
    initials: 'CS',
    turns: [
      { kind: 'client', text: 'Hola, ¿tienen cita para limpieza esta semana?' },
      { kind: 'intent', label: 'agendar_cita', conf: '0.96' },
      {
        kind: 'call',
        fn: 'crm.buscar_cliente({ tel: "+52 322 ··· 4471" })',
        result: '200 · 84 ms · Ana Torres · paciente desde 2024',
      },
      {
        kind: 'call',
        fn: 'agenda.disponibles({ servicio: "limpieza", semana: 37 })',
        result: '200 · 61 ms · jue 11:00 · vie 09:30 · vie 16:00',
      },
      {
        kind: 'agent',
        text: 'Hola Ana. Sí, esta semana tengo jueves 11:00, viernes 9:30 o viernes 16:00 con la Dra. Ruiz. ¿Cuál te acomoda?',
      },
      { kind: 'client', text: 'Jueves 11:00 por favor' },
      {
        kind: 'call',
        fn: 'agenda.crear_cita({ paciente: 1042, inicio: "jue 11:00" })',
        result: '201 · 58 ms · cita #4812 confirmada',
      },
      {
        kind: 'agent',
        text: 'Listo, quedó el jueves a las 11:00. Te mando recordatorio un día antes.',
        card: { title: 'Cita confirmada', sub: 'Jue 11:00 · Limpieza · Dra. Ruiz' },
      },
      { kind: 'ok', text: 'resuelto · 38 s · sin intervención humana' },
    ],
  },
  {
    business: 'Taller Mecánico Garza',
    initials: 'TG',
    turns: [
      { kind: 'client', text: 'Buen día, ¿cuánto sale el servicio de 10 mil km para una Hilux 2022?' },
      { kind: 'intent', label: 'cotizar_servicio', conf: '0.93' },
      {
        kind: 'call',
        fn: 'catalogo.precio({ servicio: "10k", modelo: "Hilux 2022" })',
        result: '200 · 47 ms · $2,890 MXN · 2 h',
      },
      {
        kind: 'call',
        fn: 'agenda.disponibles({ bahia: "ligeros", dias: 3 })',
        result: '200 · 52 ms · mañana 09:00 · 13:00',
      },
      {
        kind: 'agent',
        text: 'Buen día. El servicio de 10,000 km para tu Hilux 2022 sale en $2,890 (aceite sintético, filtros y revisión de 21 puntos) y toma 2 horas. Puedo recibirte mañana a las 9:00 o a la 1:00.',
      },
      { kind: 'client', text: 'A las 9 está bien, la dejo' },
      {
        kind: 'call',
        fn: 'crm.crear_orden({ unidad: "Hilux 2022", inicio: "mañana 09:00" })',
        result: '201 · 66 ms · orden OT-2210',
      },
      {
        kind: 'agent',
        text: 'Perfecto, te espero mañana a las 9:00. Tu orden OT-2210 ya quedó; te aviso por aquí cuando esté lista.',
        card: { title: 'Orden de servicio OT-2210', sub: 'Mañana 09:00 · Hilux 2022 · $2,890' },
      },
      { kind: 'ok', text: 'resuelto · 44 s · cotización + cita' },
    ],
  },
  {
    business: 'Inmobiliaria Costa Norte',
    initials: 'CN',
    turns: [
      { kind: 'client', text: 'Hola, vi el depto en Versalles de 2 recámaras, ¿sigue disponible?' },
      { kind: 'intent', label: 'consultar_propiedad', conf: '0.97' },
      {
        kind: 'call',
        fn: 'inventario.buscar({ zona: "Versalles", recamaras: 2 })',
        result: '200 · 71 ms · 2 disponibles · $3.9M · $4.2M',
      },
      {
        kind: 'agent',
        text: 'Hola. Sí, hay dos disponibles en Versalles con 2 recámaras: uno en $3.9M (78 m², 2º piso) y otro en $4.2M (85 m², roof garden). ¿Te agendo una visita?',
      },
      { kind: 'client', text: 'El de roof garden, ¿sábado?' },
      {
        kind: 'call',
        fn: 'agenda.visita({ propiedad: "VER-085", dia: "sáb", asesor: "auto" })',
        result: '201 · 63 ms · sáb 12:00 · asesor: Diego',
      },
      {
        kind: 'agent',
        text: 'Hecho, visita el sábado a las 12:00 con Diego. Te comparto la ubicación y la ficha del departamento.',
        card: { title: 'Visita agendada', sub: 'Sáb 12:00 · VER-085 · Diego M.' },
      },
      { kind: 'ok', text: 'resuelto · 41 s · lead calificado → CRM' },
    ],
  },
];

type Setter = (update: (prev: State) => State) => void;

/** Convierte una conversación en pasos de la línea de tiempo. */
function buildSteps(conv: Conversation, set: Setter): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let n = 0;
  const nextId = (p: string) => `${p}-${n++}`;

  const addLine = (line: ConsoleLine) => set((s) => ({ ...s, lines: [...s.lines, line] }));
  const patchLine = (id: string, patch: Partial<ConsoleLine>) =>
    set((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addBubble = (b: Bubble) => set((s) => ({ ...s, bubbles: [...s.bubbles, b] }));
  const patchBubble = (id: string, text: string) =>
    set((s) => ({ ...s, bubbles: s.bubbles.map((b) => (b.id === id ? { ...b, text } : b)) }));

  for (const turn of conv.turns) {
    switch (turn.kind) {
      case 'client': {
        const id = nextId('c');
        steps.push(at(900, () => addBubble({ id, from: 'cliente', text: turn.text })));
        steps.push(at(650, () => set((s) => ({ ...s, typing: true }))));
        break;
      }
      case 'intent': {
        const id = nextId('i');
        steps.push(at(300, () => addLine({ id, kind: 'intent', text: `intent → ${turn.label}` })));
        steps.push(at(420, () => patchLine(id, { text: `intent → ${turn.label} · ${turn.conf}` })));
        break;
      }
      case 'call': {
        const id = nextId('f');
        const rid = nextId('r');
        steps.push(at(260, () => addLine({ id, kind: 'call', text: '', typing: true })));
        steps.push(...typeChars(turn.fn, 16, (partial, done) => patchLine(id, { text: partial, typing: !done }), 60));
        steps.push(at(380, () => addLine({ id: rid, kind: 'result', text: `↳ ${turn.result}` })));
        break;
      }
      case 'agent': {
        const id = nextId('a');
        steps.push(
          at(320, () =>
            set((s) => ({
              ...s,
              typing: false,
              typingBubble: id,
              bubbles: [...s.bubbles, { id, from: 'agente', text: '' }],
            })),
          ),
        );
        steps.push(...typeWords(turn.text, 62, (partial) => patchBubble(id, partial), 120));
        steps.push(at(120, () => set((s) => ({ ...s, typingBubble: null }))));
        if (turn.card) {
          const cid = nextId('k');
          const card = turn.card;
          steps.push(at(460, () => addBubble({ id: cid, from: 'agente', text: '', card })));
        }
        break;
      }
      case 'ok': {
        const id = nextId('o');
        steps.push(at(520, () => addLine({ id, kind: 'ok', text: `✓ ${turn.text}` })));
        steps.push(at(10, () => set((s) => ({ ...s, done: true }))));
        break;
      }
    }
  }
  return steps;
}

/** Fotograma final de la primera conversación (modal y reduced-motion). */
function posterState(): State {
  let s: State = EMPTY;
  const set: Setter = (u) => {
    s = u(s);
  };
  buildSteps(CONVERSATIONS[0], set).forEach((step) => step.run());
  return s;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const POP = {
  initial: { opacity: 0, transform: 'translateY(6px) scale(0.96)' },
  animate: { opacity: 1, transform: 'translateY(0px) scale(1)' },
  transition: { duration: 0.28, ease: EASE_OUT },
};

export function WhatsappAiAgentBg({ poster = false }: { poster?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, still } = useSceneActive(ref, poster);
  const clock = useSceneClock(active, still);

  const [convIndex, setConvIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const [fading, setFading] = useState(false);

  const conv = CONVERSATIONS[convIndex];
  const steps = useMemo(() => {
    if (still) return null;
    const list = buildSteps(conv, setState);
    // Pausa final para leer el resultado, luego se disuelve y entra el siguiente negocio.
    list.push(at(3600, () => setFading(true)));
    return list;
    // runKey fuerza una lista nueva por corrida (el programador reinicia su índice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, still, runKey]);

  const onEnd = useCallback(() => {
    // La disolución (opacity) dura 500 ms; después se resetea y arranca la siguiente.
    window.setTimeout(() => {
      setState(EMPTY);
      setFading(false);
      setConvIndex((i) => (i + 1) % CONVERSATIONS.length);
      setRunKey((k) => k + 1);
    }, 520);
  }, []);

  useSceneTimeline(steps, active, runKey, onEnd);

  const poster0 = useMemo(() => (still ? posterState() : null), [still]);
  const view = poster0 ?? state;
  const shownConv = still ? CONVERSATIONS[0] : conv;

  return (
    <div ref={ref} className="absolute inset-0">
      <SceneFrame
        system="WhatsAgent"
        clock={clock}
        still={still}
        label="Simulación de un agente de WhatsApp con IA atendiendo un negocio: detecta la intención del cliente, consulta el CRM y la agenda mediante llamadas a herramientas, y confirma una cita sin intervención humana."
      >
        <motion.div
          className="grid h-[224px] grid-cols-[1.15fr_1fr] gap-2.5"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {/* Chat del negocio */}
          <div
            className="flex flex-col overflow-hidden rounded-xl border"
            style={{ borderColor: SCENE.line, backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            <div className="flex items-center gap-1.5 border-b px-2 py-1.5" style={{ borderColor: SCENE.line }}>
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[7px] font-bold"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: SCENE.text }}
              >
                {shownConv.initials}
              </span>
              <span className="truncate text-[9.5px] font-semibold" style={{ color: SCENE.text }}>
                {shownConv.business}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-[7.5px]" style={{ color: SCENE.muted }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#25d366' }} />
                Business
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden p-2">
              {view.bubbles.map((b) => (
                <motion.div
                  key={b.id}
                  {...(still ? {} : POP)}
                  className={
                    b.from === 'agente'
                      ? 'max-w-[88%] self-end rounded-xl rounded-br-sm border px-2 py-1.5'
                      : 'max-w-[88%] self-start rounded-xl rounded-bl-sm border px-2 py-1.5'
                  }
                  style={
                    b.from === 'agente'
                      ? { backgroundColor: 'rgba(34,211,238,0.11)', borderColor: 'rgba(34,211,238,0.28)' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: SCENE.line }
                  }
                >
                  {b.card ? (
                    <div className="flex items-stretch gap-1.5">
                      <span className="w-0.5 shrink-0 rounded-full" style={{ backgroundColor: SCENE.live }} />
                      <div>
                        <p className="text-[9px] font-semibold leading-tight" style={{ color: '#e6fbff' }}>
                          {b.card.title}
                        </p>
                        <p className="mt-0.5 text-[8px] leading-tight" style={{ color: SCENE.muted }}>
                          {b.card.sub}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {b.from === 'agente' && (
                        <p className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: SCENE.live }}>
                          WhatsAgent
                        </p>
                      )}
                      <p className="text-[9.5px] leading-snug" style={{ color: 'rgba(255,255,255,0.86)' }}>
                        {b.text}
                        {view.typingBubble === b.id && <Caret />}
                      </p>
                    </>
                  )}
                </motion.div>
              ))}
              {view.typing && (
                <motion.div
                  {...POP}
                  className="flex items-center gap-1 self-end rounded-xl rounded-br-sm border px-2.5 py-2"
                  style={{ backgroundColor: 'rgba(34,211,238,0.11)', borderColor: 'rgba(34,211,238,0.28)' }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="block h-1 w-1 rounded-full"
                      style={{ backgroundColor: SCENE.live }}
                      animate={{ transform: ['translateY(0px)', 'translateY(-3px)', 'translateY(0px)'] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* Runtime del agente */}
          <div
            className="flex flex-col overflow-hidden rounded-xl border font-mono"
            style={{ borderColor: SCENE.line, backgroundColor: 'rgba(0,0,0,0.42)' }}
          >
            <div
              className="flex items-center justify-between border-b px-2 py-1.5 text-[7.5px] uppercase tracking-[0.14em]"
              style={{ borderColor: SCENE.line, color: SCENE.muted }}
            >
              <span>agent · runtime</span>
              <span style={{ color: view.done ? SCENE.ok : SCENE.live }}>{view.done ? 'idle' : 'working'}</span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-1 overflow-hidden p-2 text-[8.5px] leading-[1.4]">
              {view.lines.map((l) => (
                <motion.p
                  key={l.id}
                  {...(still
                    ? {}
                    : {
                        initial: { opacity: 0, transform: 'translateX(-4px)' },
                        animate: { opacity: 1, transform: 'translateX(0px)' },
                        transition: { duration: 0.22, ease: EASE_OUT },
                      })}
                  className="break-words"
                  style={{
                    color:
                      l.kind === 'call'
                        ? SCENE.live
                        : l.kind === 'result'
                          ? SCENE.ok
                          : l.kind === 'ok'
                            ? SCENE.ok
                            : SCENE.text,
                    fontWeight: l.kind === 'ok' ? 700 : 400,
                  }}
                >
                  {l.kind === 'intent' && <span style={{ color: SCENE.structure }}>◆ </span>}
                  {l.kind === 'call' && <span>▸ </span>}
                  {l.text}
                  {l.typing && <Caret />}
                </motion.p>
              ))}
            </div>
          </div>
        </motion.div>
      </SceneFrame>
    </div>
  );
}

/** Cursor de tipeo: parpadea con opacity (composited). */
function Caret() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-px inline-block h-[1em] w-[2px] translate-y-[2px] rounded-sm align-baseline"
      style={{ backgroundColor: SCENE.live }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  );
}
