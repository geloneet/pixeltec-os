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
import { Plus, DollarSign, Building2, User, Briefcase, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// --- INTERFACES & CONSTANTS ---
interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  stage: 'Lead nuevo' | 'Contactado' | 'Reunión agendada' | 'Propuesta enviada' | 'Negociación' | 'Ganado' | 'Perdido';
  estimatedValue: number;
  closeProbability: number;
  interestedService: string;
}

interface Column {
  id: string;
  title: string;
}

const PIPELINE_STAGES: Column[] = [
  { id: 'Lead nuevo', title: 'Lead nuevo' },
  { id: 'Contactado', title: 'Contactado' },
  { id: 'Reunión agendada', title: 'Reunión agendada' },
  { id: 'Propuesta enviada', title: 'Propuesta enviada' },
  { id: 'Negociación', title: 'Negociación' },
  { id: 'Ganado', title: 'Ganado' },
  { id: 'Perdido', title: 'Perdido' },
];

const stageColors = {
    'Ganado': 'border-lime-500/50 hover:border-lime-500/80',
    'Perdido': 'border-red-500/50 hover:border-red-500/80'
};

// --- HELPER FUNCTIONS ---
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
};

// --- SORTABLE LEAD CARD ---
interface SortableLeadCardProps {
  lead: Lead;
}

const SortableLeadCard: FC<SortableLeadCardProps> = ({ lead }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: { type: 'Lead', lead },
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
      className={cn(
        'relative bg-[#0A0A0A] border border-white/10 rounded-xl p-4 shadow-md transition-all duration-300 touch-none cursor-grab active:cursor-grabbing',
        'hover:border-cyan-500/50 hover:shadow-lg hover:-translate-y-1',
        isDragging && 'opacity-60 ring-2 ring-cyan-500 ring-offset-2 ring-offset-black',
      )}
    >
      <h4 className="font-bold text-base text-white pr-6 flex items-center gap-2"><Building2 size={16}/> {lead.companyName}</h4>
      <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2"><User size={14}/>{lead.contactName}</p>
      
      <div className="border-t border-white/10 my-3"></div>

      <div className="space-y-2 text-xs text-zinc-300">
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-zinc-400"><Briefcase size={14}/> Servicio:</span>
            <span className="font-medium">{lead.interestedService}</span>
        </div>
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-zinc-400"><DollarSign size={14}/> Valor:</span>
            <span className="font-medium text-lime-400">{formatCurrency(lead.estimatedValue)}</span>
        </div>
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-zinc-400"><Percent size={14}/> Probabilidad:</span>
            <span className="font-medium">{lead.closeProbability}%</span>
        </div>
      </div>
    </div>
  );
};


// --- PIPELINE COLUMN ---
interface PipelineColumnProps {
  column: Column;
  leads: Lead[];
  onAddClick: (stage: string) => void;
}

const PipelineColumn: FC<PipelineColumnProps> = ({ column, leads, onAddClick }) => {
    const leadIds = useMemo(() => leads.map(l => l.id), [leads]);
    const { setNodeRef } = useDroppable({
        id: column.id,
        data: { type: 'Column' }
    });
    const columnColorClass = stageColors[column.id as keyof typeof stageColors] || 'border-white/10';

  return (
    <div className="w-80 flex-shrink-0 flex flex-col gap-4">
       <div className="flex justify-between items-center px-2">
            <h3 className="font-semibold text-zinc-400">{column.title}</h3>
            <span className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-zinc-300 font-mono">
                {leads.length}
            </span>
       </div>
       <div ref={setNodeRef} className={cn("flex-1 bg-[#09090b] border-2 border-dashed rounded-2xl p-2 space-y-2 overflow-y-auto min-h-[300px] h-full transition-colors", columnColorClass)}>
            <SortableContext items={leadIds} id={column.id}>
                {leads.map(l => <SortableLeadCard key={l.id} lead={l} />)}
            </SortableContext>
       </div>
    </div>
  );
};

// --- SALES PIPELINE BOARD ---
interface SalesPipelineBoardProps {
  leads: Lead[];
  onAddLead: (stage: string) => void;
}

export default function SalesPipelineBoard({ leads, onAddLead }: SalesPipelineBoardProps) {
  const firestore = useFirestore();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    })
  );

  const leadsByStage = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.id] = leads.filter(l => l.stage === stage.id);
      return acc;
    }, {} as Record<string, Lead[]>);
  }, [leads]);


  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Lead') {
      setActiveLead(event.active.data.current.lead);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;

    if (!active || !over) return;

    const activeId = active.id.toString();
    const activeLeadData = active.data.current?.lead as Lead;
    
    if (!activeLeadData) return;

    let newStage: Lead['stage'];
    if (over.data.current?.type === 'Column') {
        newStage = over.id as Lead['stage'];
    } else if (over.data.current?.type === 'Lead') {
        newStage = over.data.current!.lead.stage as Lead['stage'];
    } else {
        return;
    }

    if (newStage && newStage !== activeLeadData.stage) {
        if (!firestore) return;
        const leadRef = doc(firestore, 'leads', activeId);
        try {
            await updateDoc(leadRef, { stage: newStage });
        } catch (error) {
            console.error("Error updating lead stage: ", error);
        }
    }
  };

  return (
    <div className="flex gap-6 overflow-x-auto w-full p-2 h-full">
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} collisionDetection={closestCorners}>
        {PIPELINE_STAGES.map(col => (
          <PipelineColumn
            key={col.id}
            column={col}
            leads={leadsByStage[col.id] || []}
            onAddClick={onAddLead}
          />
        ))}

        <DragOverlay>
            {activeLead ? <SortableLeadCard lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
