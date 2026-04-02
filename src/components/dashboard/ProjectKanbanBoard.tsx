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
import { doc, updateDoc } from 'firebase/firestore';
import { createActivityLog } from '@/utils/createLog';

// --- INTERFACES ---
interface Project {
  id: string;
  name: string;
  type: 'Web' | 'Automatización' | 'Marketing' | 'App';
  status: 'Planeación' | 'En desarrollo' | 'En revisión' | 'Entregado' | 'Cancelado';
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
  assignedTo: string;
}

interface Column {
  id: string;
  title: string;
}

const COLUMNS: Column[] = [
  { id: 'Planeación', title: 'Planeación' },
  { id: 'En desarrollo', title: 'En desarrollo' },
  { id: 'En revisión', title: 'En revisión' },
  { id: 'Entregado', title: 'Entregado' },
  { id: 'Cancelado', title: 'Cancelado' },
];

const priorityStyles = {
  Baja: 'border-l-zinc-500',
  Media: 'border-l-sky-500',
  Alta: 'border-l-yellow-500',
  Urgente: 'border-l-red-500',
};

const typeStyles = {
    Web: 'bg-blue-500/20 text-blue-400',
    Automatización: 'bg-purple-500/20 text-purple-400',
    Marketing: 'bg-pink-500/20 text-pink-400',
    App: 'bg-green-500/20 text-green-400',
};

// --- SORTABLE KANBAN CARD ---
interface SortableProjectCardProps {
  project: Project;
  onProjectClick: (id: string) => void;
}

const SortableProjectCard: FC<SortableProjectCardProps> = ({ project, onProjectClick }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    data: {
      type: 'Project',
      project,
    },
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
      onClick={() => onProjectClick(project.id)}
      className={cn(
        'relative bg-black border border-white/5 rounded-xl p-4 shadow-md transition-all duration-300 touch-none cursor-grab active:cursor-grabbing',
        'hover:border-white/15 hover:shadow-lg',
        isDragging && 'opacity-50 ring-2 ring-cyan-500 ring-offset-2 ring-offset-black',
        priorityStyles[project.priority],
        'border-l-4'
      )}
    >
      <h4 className="font-bold text-base text-white pr-6">{project.name}</h4>
      <div className="flex items-center justify-between mt-3 text-xs">
        <span className={cn('px-2 py-0.5 rounded-full font-semibold', typeStyles[project.type])}>
          {project.type}
        </span>
        <span className="text-zinc-400">{project.assignedTo}</span>
      </div>
    </div>
  );
};


// --- KANBAN COLUMN ---
interface KanbanColumnProps {
  column: Column;
  projects: Project[];
  onAddClick: (status: string) => void;
  onProjectClick: (id: string) => void;
}

const KanbanColumn: FC<KanbanColumnProps> = ({ column, projects, onAddClick, onProjectClick }) => {
    const projectIds = useMemo(() => projects.map(p => p.id), [projects]);
    const { setNodeRef } = useDroppable({
        id: column.id,
        data: {
            type: 'Column'
        }
    });

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-4">
       <div className="flex justify-between items-center px-2">
            <h3 className="font-semibold text-zinc-400">{column.title} ({projects.length})</h3>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => onAddClick(column.id)}>
                <Plus size={16} />
            </Button>
       </div>
       <div ref={setNodeRef} className="flex-1 bg-white/5 rounded-2xl p-2 space-y-2 overflow-y-auto min-h-[300px] h-full">
            <SortableContext items={projectIds} id={column.id}>
                {projects.map(p => <SortableProjectCard key={p.id} project={p} onProjectClick={onProjectClick} />)}
            </SortableContext>
       </div>
    </div>
  );
};

// --- KANBAN BOARD ---
interface ProjectKanbanBoardProps {
  projects: Project[];
  clientId: string;
  onAddProject: (status: string) => void;
  onProjectClick: (id: string) => void;
}

export default function ProjectKanbanBoard({ projects, clientId, onAddProject, onProjectClick }: ProjectKanbanBoardProps) {
  const firestore = useFirestore();
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const projectsByColumn = useMemo(() => {
    return COLUMNS.reduce((acc, column) => {
      acc[column.id] = projects.filter(p => p.status === column.id);
      return acc;
    }, {} as Record<string, Project[]>);
  }, [projects]);


  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Project') {
      setActiveProject(event.active.data.current.project);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveProject(null);
    const { active, over } = event;

    if (!active || !over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    const activeProjectData = active.data.current?.project as Project;
    
    if (!activeProjectData) return;

    // Determine the new status based on what we dropped over
    let newStatus: Project['status'];
    const overIsColumn = over.data.current?.type === 'Column';
    const overIsProject = over.data.current?.type === 'Project';
    
    if (overIsColumn) {
        newStatus = overId as Project['status'];
    } else if (overIsProject) {
        newStatus = over.data.current!.project.status as Project['status'];
    } else {
        return; // Invalid drop target
    }

    if (newStatus && newStatus !== activeProjectData.status) {
        if (!firestore) return;
        const projectRef = doc(firestore, 'clients', clientId, 'projects', activeId);
        try {
            await updateDoc(projectRef, { status: newStatus });
            await createActivityLog(firestore, {
                type: 'project',
                message: `Proyecto "${activeProjectData.name}" movido a: ${newStatus}`,
                link: `/dashboard/clients/${clientId}`
            });
        } catch (error) {
            console.error("Error updating project status: ", error);
        }
    }
  };

  return (
    <div className="flex gap-6 overflow-x-auto w-full p-2">
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} collisionDetection={closestCorners}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            projects={projectsByColumn[col.id] || []}
            onAddClick={onAddProject}
            onProjectClick={onProjectClick}
          />
        ))}

        <DragOverlay>
            {activeProject ? <SortableProjectCard project={activeProject} onProjectClick={() => {}} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
