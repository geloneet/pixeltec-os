'use client';

import { useState, useMemo, FC } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { Ticket } from '@/app/dashboard/support/page';
import { createActivityLog } from '@/utils/createLog';

// --- INTERFACES & CONSTANTS ---

interface Column {
  id: string;
  title: string;
}

const TICKET_STAGES: Column[] = [
  { id: 'Abierto', title: 'Abierto' },
  { id: 'En proceso', title: 'En proceso' },
  { id: 'Esperando cliente', title: 'Esperando cliente' },
  { id: 'Resuelto', title: 'Resuelto' },
];

const priorityColors = {
  Baja: 'border-l-zinc-500',
  Media: 'border-l-yellow-500',
  Alta: 'border-l-red-500',
};

const categoryColors = {
    Hosting: 'bg-indigo-500/20 text-indigo-400',
    'Página web': 'bg-sky-500/20 text-sky-400',
    Correo: 'bg-amber-500/20 text-amber-400',
    Automatización: 'bg-purple-500/20 text-purple-400',
    Hardware: 'bg-slate-500/20 text-slate-400',
    Otro: 'bg-gray-500/20 text-gray-400',
};

// --- SORTABLE TICKET CARD ---
interface SortableTicketCardProps {
  ticket: Ticket;
  onTicketClick: (id: string) => void;
}

const SortableTicketCard: FC<SortableTicketCardProps> = ({ ticket, onTicketClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: { type: 'Ticket', ticket },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onTicketClick(ticket.id)}
      className={cn(
        'relative bg-[#0A0A0A] border border-white/10 rounded-xl p-4 shadow-md transition-all duration-300 touch-none cursor-grab active:cursor-grabbing',
        'hover:border-cyan-500/50 hover:shadow-lg hover:-translate-y-1',
        isDragging && 'opacity-60 ring-2 ring-cyan-500 ring-offset-2 ring-offset-black',
        priorityColors[ticket.prioridad],
        'border-l-4'
      )}
    >
        <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-xs text-zinc-400">{ticket.ticketId}</span>
            <span className={cn('px-2 py-0.5 rounded text-[11px] font-semibold', categoryColors[ticket.categoría])}>
                {ticket.categoría}
            </span>
        </div>
      <h4 className="font-bold text-white pr-6 line-clamp-2">{ticket.problema}</h4>
      <p className="text-sm text-zinc-400 mt-2">{ticket.cliente}</p>
    </div>
  );
};


// --- TICKET COLUMN ---
interface TicketColumnProps {
  column: Column;
  tickets: Ticket[];
  onAddClick: (stage: string) => void;
  onTicketClick: (id: string) => void;
}

const TicketColumn: FC<TicketColumnProps> = ({ column, tickets, onAddClick, onTicketClick }) => {
    const ticketIds = useMemo(() => tickets.map(l => l.id), [tickets]);
    const { setNodeRef } = useDroppable({
        id: column.id,
        data: { type: 'Column' }
    });

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-4">
       <div className="flex justify-between items-center px-2">
            <h3 className="font-semibold text-zinc-400">{column.title}</h3>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => onAddClick(column.id)}>
                <Plus size={16} />
            </Button>
       </div>
       <div ref={setNodeRef} className="flex-1 bg-[#09090b] rounded-2xl p-2 space-y-2 overflow-y-auto min-h-[300px] h-full">
            <SortableContext items={ticketIds} id={column.id}>
                {tickets.map(t => <SortableTicketCard key={t.id} ticket={t} onTicketClick={onTicketClick} />)}
            </SortableContext>
       </div>
    </div>
  );
};

// --- SUPPORT TICKET BOARD ---
interface SupportTicketBoardProps {
  tickets: Ticket[];
  onAddTicket: (stage: string) => void;
  onTicketClick: (id: string) => void;
}

export default function SupportTicketBoard({ tickets, onAddTicket, onTicketClick }: SupportTicketBoardProps) {
  const firestore = useFirestore();
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  const ticketsByStage = useMemo(() => {
    return TICKET_STAGES.reduce((acc, stage) => {
      acc[stage.id] = tickets.filter(l => l.estado === stage.id);
      return acc;
    }, {} as Record<string, Ticket[]>);
  }, [tickets]);


  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Ticket') {
      setActiveTicket(event.active.data.current.ticket);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveTicket(null);
    const { active, over } = event;

    if (!active || !over) return;

    const activeId = active.id.toString();
    const activeTicketData = active.data.current?.ticket as Ticket;
    
    if (!activeTicketData) return;

    let newStatus: Ticket['estado'];
    if (over.data.current?.type === 'Column') {
        newStatus = over.id as Ticket['estado'];
    } else if (over.data.current?.type === 'Ticket') {
        newStatus = over.data.current!.ticket.estado as Ticket['estado'];
    } else {
        return;
    }

    if (newStatus && newStatus !== activeTicketData.estado) {
        if (!firestore) return;
        const ticketRef = doc(firestore, 'tickets', activeId);
        try {
            const updateData: { estado: string; fechaCierre?: any } = { estado: newStatus };
            if (newStatus === 'Resuelto') {
                updateData.fechaCierre = serverTimestamp();
            }
            await updateDoc(ticketRef, updateData);

            await createActivityLog(firestore, {
                type: 'support',
                message: `El ticket #${activeTicketData.ticketId} (${activeTicketData.cliente}) se movió a: ${newStatus}`,
                link: `/dashboard/support`
            });

        } catch (error) {
            console.error("Error updating ticket status: ", error);
        }
    }
  };

  return (
    <div className="flex gap-6 overflow-x-auto w-full p-2 h-full">
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} collisionDetection={closestCorners}>
        {TICKET_STAGES.map(col => (
          <TicketColumn
            key={col.id}
            column={col}
            tickets={ticketsByStage[col.id] || []}
            onAddClick={onAddTicket}
            onTicketClick={onTicketClick}
          />
        ))}

        <DragOverlay>
            {activeTicket ? <SortableTicketCard ticket={activeTicket} onTicketClick={onTicketClick}/> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
