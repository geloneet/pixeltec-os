'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DEVICE, EASE_OUT, ENTER, PANEL, SCENE, SPRING, SceneFrame, type SceneProps } from './scene-frame';
import { at, useSceneActive, useSceneTimeline, type TimelineStep } from './use-scene-timeline';

/**
 * WO-2026-00275 · Servicio "Automatización con IA" · ronda 2.
 *
 * Antes (ronda 1): chat + consola monoespaciada del agente (`tool.call
 * crm.buscar_cliente({...})`, `200 · 84 ms`, tipeo carácter a carácter).
 * Ahora: la escena cuenta lo mismo —un agente atiende y resuelve solo— pero en
 * lenguaje de persona, no de desarrollador:
 *  - Izquierda: un chat de WhatsApp limpio y reconocible (avatar, nombre,
 *    "en línea / escribiendo…", burbujas sin borde, doble palomita azul,
 *    hora). Sin chrome técnico ni etiquetas por burbuja. Los mensajes del
 *    agente aparecen completos tras "escribiendo…", como en WhatsApp real: se
 *    elimina el typewriter.
 *  - Derecha: el agente como presencia (un orbe de luz de marca que respira
 *    mientras trabaja) y lo que hizo, en tres pasos legibles con palomita:
 *    "Paciente identificada", "Agenda consultada", "Cita confirmada". Cierra
 *    con "Resuelto en 38 s · sin intervención humana".
 * Tres negocios rotan para que nunca se lea como loop.
 */

type Bubble = {
  id: string;
  from: 'cliente' | 'agente';
  text: string;
  time: string;
  card?: { title: string; sub: string };
};

type Action = { id: string; label: string; detail: string; done: boolean };

type State = {
  bubbles: Bubble[];
  typing: boolean;
  actions: Action[];
  done: string | null;
};

const EMPTY: State = { bubbles: [], typing: false, actions: [], done: null };

type Turn =
  | { kind: 'client'; text: string; time: string }
  | { kind: 'action'; label: string; detail: string }
  | { kind: 'agent'; text: string; time: string; card?: { title: string; sub: string } }
  | { kind: 'done'; text: string };

type Conversation = { business: string; initials: string; turns: Turn[] };

const CONVERSATIONS: Conversation[] = [
  {
    business: 'Clínica Dental Sonrisa',
    initials: 'CS',
    turns: [
      { kind: 'client', text: 'Hola, ¿tienen cita para limpieza esta semana?', time: '10:42' },
      { kind: 'action', label: 'Paciente identificada', detail: 'Ana Torres · desde 2024' },
      { kind: 'action', label: 'Agenda consultada', detail: '3 horarios disponibles' },
      {
        kind: 'agent',
        text: 'Hola Ana. Tengo jueves 11:00, viernes 9:30 o 16:00 con la Dra. Ruiz. ¿Cuál te acomoda?',
        time: '10:42',
      },
      { kind: 'client', text: 'Jueves 11:00, por favor', time: '10:43' },
      { kind: 'action', label: 'Cita confirmada', detail: 'Jueves 11:00 · Dra. Ruiz' },
      {
        kind: 'agent',
        text: 'Listo, quedó el jueves a las 11:00. Te recuerdo un día antes.',
        time: '10:43',
        card: { title: 'Cita confirmada', sub: 'Jueves 11:00 · Limpieza dental' },
      },
      { kind: 'done', text: 'Resuelto en 38 s' },
    ],
  },
  {
    business: 'Taller Mecánico Garza',
    initials: 'TG',
    turns: [
      { kind: 'client', text: 'Buen día, ¿cuánto sale el servicio de 10 mil km para una Hilux 2022?', time: '09:15' },
      { kind: 'action', label: 'Precio consultado', detail: 'Servicio 10,000 km · Hilux' },
      { kind: 'action', label: 'Bahía disponible', detail: 'Mañana 9:00 y 13:00' },
      {
        kind: 'agent',
        text: 'Buen día. Sale en $2,890 con aceite sintético y revisión de 21 puntos. ¿Te recibo mañana a las 9:00 o a la 1:00?',
        time: '09:15',
      },
      { kind: 'client', text: 'A las 9 está bien, la dejo', time: '09:16' },
      { kind: 'action', label: 'Orden creada', detail: 'OT-2210 · mañana 9:00' },
      {
        kind: 'agent',
        text: 'Perfecto, te espero mañana a las 9:00. Te aviso por aquí cuando esté lista.',
        time: '09:16',
        card: { title: 'Orden de servicio OT-2210', sub: 'Mañana 9:00 · Hilux 2022 · $2,890' },
      },
      { kind: 'done', text: 'Resuelto en 44 s' },
    ],
  },
  {
    business: 'Inmobiliaria Costa Norte',
    initials: 'CN',
    turns: [
      { kind: 'client', text: 'Hola, vi el depto en Versalles de 2 recámaras, ¿sigue disponible?', time: '17:20' },
      { kind: 'action', label: 'Inventario revisado', detail: '2 disponibles en Versalles' },
      {
        kind: 'agent',
        text: 'Hola. Sí, hay dos: uno en $3.9M (78 m²) y otro en $4.2M con roof garden. ¿Te agendo una visita?',
        time: '17:20',
      },
      { kind: 'client', text: 'El de roof garden, ¿sábado?', time: '17:21' },
      { kind: 'action', label: 'Asesor asignado', detail: 'Diego M. · sábado 12:00' },
      { kind: 'action', label: 'Visita agendada', detail: 'Ficha enviada al cliente' },
      {
        kind: 'agent',
        text: 'Hecho, visita el sábado a las 12:00 con Diego. Te comparto la ubicación y la ficha.',
        time: '17:21',
        card: { title: 'Visita agendada', sub: 'Sábado 12:00 · Versalles · roof garden' },
      },
      { kind: 'done', text: 'Resuelto en 41 s' },
    ],
  },
];

type Setter = (update: (prev: State) => State) => void;

/** Convierte una conversación en pasos de la línea de tiempo. */
function buildSteps(conv: Conversation, set: Setter): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let n = 0;
  const nextId = (p: string) => `${p}-${n++}`;
  const addBubble = (b: Bubble) => set((s) => ({ ...s, bubbles: [...s.bubbles, b] }));

  for (const turn of conv.turns) {
    switch (turn.kind) {
      case 'client': {
        const id = nextId('c');
        steps.push(at(900, () => addBubble({ id, from: 'cliente', text: turn.text, time: turn.time })));
        steps.push(at(700, () => set((s) => ({ ...s, typing: true }))));
        break;
      }
      case 'action': {
        const id = nextId('a');
        steps.push(
          at(420, () =>
            set((s) => ({ ...s, actions: [...s.actions, { id, label: turn.label, detail: turn.detail, done: false }] })),
          ),
        );
        steps.push(
          at(620, () => set((s) => ({ ...s, actions: s.actions.map((a) => (a.id === id ? { ...a, done: true } : a)) }))),
        );
        break;
      }
      case 'agent': {
        const id = nextId('m');
        steps.push(
          at(520, () =>
            set((s) => ({
              ...s,
              typing: false,
              bubbles: [...s.bubbles, { id, from: 'agente', text: turn.text, time: turn.time }],
            })),
          ),
        );
        if (turn.card) {
          const cid = nextId('k');
          const card = turn.card;
          steps.push(at(700, () => addBubble({ id: cid, from: 'agente', text: '', time: turn.time, card })));
        }
        break;
      }
      case 'done': {
        steps.push(at(700, () => set((s) => ({ ...s, done: turn.text }))));
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

export function WhatsappAiAgentBg({ poster = false, layout, stageClassName }: SceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { active, still } = useSceneActive(ref, poster);

  const [convIndex, setConvIndex] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [state, setState] = useState<State>(EMPTY);
  const [fading, setFading] = useState(false);

  const conv = CONVERSATIONS[convIndex];
  const steps = useMemo(() => {
    if (still) return null;
    const list = buildSteps(conv, setState);
    // Pausa para leer el resultado; luego se disuelve y entra el siguiente negocio.
    list.push(at(3800, () => setFading(true)));
    return list;
    // runKey fuerza una lista nueva por corrida (el programador reinicia su índice).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, still, runKey]);

  const onEnd = useCallback(() => {
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
  const working = !still && view.bubbles.length > 0 && !view.done;

  return (
    <div ref={ref} className="absolute inset-0">
      <SceneFrame layout={layout} stageClassName={stageClassName} label="Simulación con datos ficticios de un agente de WhatsApp con IA atendiendo un negocio: identifica al cliente, consulta la agenda y confirma una cita sin intervención humana.">
        <motion.div
          className="grid h-[232px] grid-cols-[1.25fr_1fr] gap-3"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {/* ---------- Chat (pantalla del negocio) ---------- */}
          <div className="flex flex-col overflow-hidden rounded-[18px]" style={DEVICE}>
            <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))',
                  color: SCENE.text,
                }}
              >
                {shownConv.initials}
              </span>
              <span className="min-w-0 leading-none">
                <span className="block truncate text-[10.5px] font-semibold" style={{ color: SCENE.text }}>
                  {shownConv.business}
                </span>
                <span
                  className="mt-[3px] block text-[8.5px] font-medium"
                  style={{ color: view.typing ? SCENE.brand : SCENE.muted }}
                >
                  {view.typing ? 'escribiendo…' : 'en línea'}
                </span>
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden px-2.5 pb-2.5 pt-1">
              {view.bubbles.map((b) => (
                <motion.div
                  key={b.id}
                  {...(still ? {} : ENTER)}
                  className={
                    b.from === 'agente'
                      ? 'max-w-[86%] self-end rounded-[14px] rounded-br-[4px] px-2.5 py-1.5'
                      : 'max-w-[86%] self-start rounded-[14px] rounded-bl-[4px] px-2.5 py-1.5'
                  }
                  style={{
                    background: b.from === 'agente' ? 'rgba(0, 110, 90, 0.72)' : 'rgba(255,255,255,0.09)',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.25)',
                  }}
                >
                  {b.card ? (
                    <div className="flex items-stretch gap-2 py-0.5">
                      <span className="w-[3px] shrink-0 rounded-full" style={{ backgroundColor: SCENE.ok }} />
                      <div>
                        <p className="text-[9.5px] font-semibold leading-tight" style={{ color: SCENE.text }}>
                          {b.card.title}
                        </p>
                        <p className="mt-0.5 text-[8.5px] leading-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {b.card.sub}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] leading-[1.35]" style={{ color: SCENE.text }}>
                      {b.text}
                      <span
                        className="ml-1.5 inline-flex translate-y-[1px] items-center gap-0.5 whitespace-nowrap text-[7.5px]"
                        style={{ color: 'rgba(255,255,255,0.55)' }}
                      >
                        {b.time}
                        {b.from === 'agente' && <Ticks />}
                      </span>
                    </p>
                  )}
                </motion.div>
              ))}
              {view.typing && (
                <motion.div
                  {...ENTER}
                  className="flex items-center gap-[3px] self-end rounded-[14px] rounded-br-[4px] px-3 py-2"
                  style={{ background: 'rgba(0, 110, 90, 0.72)' }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="block h-1 w-1 rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* ---------- El agente: presencia + lo que hizo ---------- */}
          <div className="flex flex-col overflow-hidden rounded-[18px] px-3 pb-3 pt-3" style={PANEL}>
            <div className="flex items-center gap-2">
              <Orb working={working} />
              <span className="min-w-0 leading-none">
                <span className="block text-[10.5px] font-semibold" style={{ color: SCENE.text }}>
                  Agente IA
                </span>
                <span className="mt-[3px] block text-[8.5px] font-medium" style={{ color: SCENE.muted }}>
                  {view.done ? 'Listo' : working ? 'Trabajando…' : 'Atento'}
                </span>
              </span>
            </div>

            <div className="mt-3 flex flex-1 flex-col gap-2 overflow-hidden">
              {view.actions.map((a) => (
                <motion.div key={a.id} {...(still ? {} : ENTER)} className="flex items-start gap-2">
                  <Check done={a.done} still={still} />
                  <span className="min-w-0 leading-none">
                    <span className="block truncate text-[9.5px] font-medium" style={{ color: SCENE.text }}>
                      {a.label}
                    </span>
                    <span className="mt-[3px] block truncate text-[8px]" style={{ color: SCENE.muted }}>
                      {a.detail}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>

            {view.done && (
              <motion.div
                {...(still ? {} : ENTER)}
                className="mt-2 rounded-xl px-2.5 py-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(52,211,153,0.16), rgba(34,211,238,0.10))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <p className="text-[9.5px] font-semibold leading-none" style={{ color: SCENE.text }}>
                  {view.done}
                </p>
                <p className="mt-1 text-[8px] leading-none" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  Sin intervención humana
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </SceneFrame>
    </div>
  );
}

/** Presencia del agente: orbe de luz de marca. Respira solo mientras trabaja. */
function Orb({ working }: { working: boolean }) {
  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.55), rgba(59,130,246,0) 70%)', filter: 'blur(4px)' }}
        animate={working ? { scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] } : { scale: 1.1, opacity: 0.55 }}
        transition={working ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : SPRING}
      />
      <motion.span
        className="relative block h-4 w-4 rounded-full"
        style={{
          background: 'linear-gradient(145deg, #7dd3fc 0%, #22d3ee 45%, #2563eb 100%)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.55), 0 2px 6px rgba(34,211,238,0.35)',
        }}
        animate={working ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={working ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : SPRING}
      />
    </span>
  );
}

/** Paso del agente: anillo mientras se hace, palomita dibujada al terminar. */
function Check({ done, still }: { done: boolean; still: boolean }) {
  return (
    <span className="relative mt-px flex h-[14px] w-[14px] shrink-0 items-center justify-center">
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={{
          backgroundColor: done ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0)',
          borderColor: done ? 'rgba(52,211,153,0.6)' : 'rgba(34,211,238,0.55)',
        }}
        transition={{ duration: 0.3 }}
        style={{ borderWidth: 1.25, borderStyle: 'solid' }}
      />
      {done && (
        <svg viewBox="0 0 14 14" className="relative h-[14px] w-[14px]" aria-hidden="true">
          <motion.path
            d="M4 7.2 L6.2 9.3 L10.2 4.9"
            fill="none"
            stroke={SCENE.ok}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={still ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          />
        </svg>
      )}
    </span>
  );
}

/** Doble palomita azul de WhatsApp (leído). */
function Ticks() {
  return (
    <svg viewBox="0 0 16 10" className="h-[8px] w-[12px]" aria-hidden="true">
      <path d="M1 5.5 L4 8.5 L9.5 2" fill="none" stroke="#53bdeb" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 5.5 L9.5 8.5 L15 2" fill="none" stroke="#53bdeb" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
