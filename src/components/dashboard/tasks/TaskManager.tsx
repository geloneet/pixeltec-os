'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
} from 'firebase/firestore';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, getInitials } from '@/lib/utils';
import {
  format,
  isPast,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Trash2,
  LoaderCircle,
  Plus,
  ListTodo,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AddTaskModal from './AddTaskModal';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';
import { createActivityLog } from '@/utils/createLog';

interface Task {
  id: string;
  title: string;
  responsible: string;
  dueDate: any; // Firestore Timestamp
  status: 'Pendiente' | 'En proceso' | 'Completada';
  createdAt: any; // Firestore Timestamp
}

type FilterStatus = 'Todas' | 'Pendientes' | 'Completadas';

export default function TaskManager() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('Pendientes');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  useEffect(() => {
    if (!firestore) return;

    setLoading(true);
    const tasksQuery = query(collection(firestore, 'tasks'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(tasksQuery,
      (snapshot) => {
        const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        setTasks(tasksData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tasks: ", error);
        toast({
          title: 'Error de Conexión',
          description: 'No se pudieron cargar las tareas. Revisa tu conexión y permisos de Firestore.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, toast]);

  const handleToggleTask = async (taskId: string, currentStatus: Task['status']) => {
    if (!firestore) return;
    const newStatus = currentStatus === 'Completada' ? 'Pendiente' : 'Completada';
    try {
      await updateDoc(doc(firestore, 'tasks', taskId), { status: newStatus });
      if (newStatus === 'Completada') {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          await createActivityLog(firestore, {
            message: `Tarea global completada: "${task.title}"`,
            type: 'project',
            link: '/dashboard/tasks'
          });
        }
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!firestore || !taskToDelete) return;
    await deleteDoc(doc(firestore, 'tasks', taskToDelete.id));
    toast({ description: `Tarea "${taskToDelete.title}" eliminada.` });
    setTaskToDelete(null);
  };

  const filteredTasks = useMemo(() => {
    if (filter === 'Pendientes') return tasks.filter(t => t.status !== 'Completada');
    if (filter === 'Completadas') return tasks.filter(t => t.status === 'Completada');
    return tasks;
  }, [tasks, filter]);

  return (
    <>
      <div className="bg-black text-white rounded-[2rem] border border-white/5 p-8 shadow-2xl h-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight flex items-center gap-3"><ListTodo size={36}/> Gestor de Tareas</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1 rounded-full">
                {(['Pendientes', 'Completadas', 'Todas'] as FilterStatus[]).map(f => (
                    <Button 
                        key={f} 
                        onClick={() => setFilter(f)} 
                        variant={filter === f ? 'secondary' : 'ghost'}
                        className={cn('rounded-full px-4 h-8 text-sm', filter === f && 'bg-white text-black hover:bg-white/90')}
                    >
                        {f}
                    </Button>
                ))}
            </div>
             <Button onClick={() => setIsModalOpen(true)} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold h-10">
                <Plus className="mr-2 h-4 w-4"/> Añadir Tarea
            </Button>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
          {loading ? (
              <div className="flex items-center justify-center h-full text-zinc-500"><LoaderCircle className="animate-spin mr-2" />Cargando tareas...</div>
          ) : filteredTasks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-500">No hay tareas en esta vista.</div>
          ) : (
              filteredTasks.map(task => (
                  <div key={task.id} className="group flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl transition-all hover:bg-white/10">
                      <Checkbox id={`task-${task.id}`} checked={task.status === 'Completada'} onCheckedChange={() => handleToggleTask(task.id, task.status)} className="border-zinc-500 data-[state=checked]:bg-cyan-500" />
                      <label htmlFor={`task-${task.id}`} className={cn("flex-1 text-zinc-200 cursor-pointer", task.status === 'Completada' && 'line-through text-zinc-500')}>
                          {task.title}
                      </label>
                      <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2 text-zinc-400">
                              <Avatar className="h-6 w-6 text-xs">
                                  <AvatarFallback>{getInitials(task.responsible)}</AvatarFallback>
                              </Avatar>
                              <span>{task.responsible}</span>
                          </div>
                          <div className={cn('font-mono px-2 py-1 rounded-md text-xs', task.dueDate && isPast(task.dueDate.toDate()) && task.status !== 'Completada' ? 'text-red-400 bg-red-500/10' : 'text-zinc-500')}>
                              {task.dueDate ? format(task.dueDate.toDate(), 'dd MMM', { locale: es }) : 'Sin fecha'}
                          </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-500" onClick={() => handleDeleteTask(task)} aria-label="Eliminar tarea"><Trash2 size={16}/></Button>
                  </div>
              ))
          )}
        </div>
      </div>
      <AddTaskModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar tarea"
        description={`¿Eliminar "${taskToDelete?.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
