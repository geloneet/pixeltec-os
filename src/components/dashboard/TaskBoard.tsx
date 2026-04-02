'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Plus, Trash2, LoaderCircle, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: any;
}

interface TaskBoardProps {
  clientId: string;
  projectId: string;
  tasks: Task[];
  loading: boolean;
}

export default function TaskBoard({ clientId, projectId, tasks, loading }: TaskBoardProps) {
  const firestore = useFirestore();
  const [newTaskText, setNewTaskText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !newTaskText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const tasksCollectionRef = collection(firestore, 'clients', clientId, 'projects', projectId, 'tasks');
      await addDoc(tasksCollectionRef, {
        text: newTaskText,
        completed: false,
        createdAt: serverTimestamp(),
      });
      setNewTaskText('');
    } catch (error) {
      console.error("Error adding task: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
    if (!firestore) return;
    const taskDocRef = doc(firestore, 'clients', clientId, 'projects', projectId, 'tasks', taskId);
    try {
      await updateDoc(taskDocRef, {
        completed: !currentStatus,
        completedAt: !currentStatus ? serverTimestamp() : null,
       });
    } catch (error) {
      console.error("Error toggling task: ", error);
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
    if (!firestore) return;
    const taskDocRef = doc(firestore, 'clients', clientId, 'projects', projectId, 'tasks', taskId);
    try {
        await deleteDoc(taskDocRef);
    } catch (error) {
        console.error("Error deleting task: ", error);
    }
  };

  const handleClearCompleted = async () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const completedTasks = tasks.filter(task => task.completed);
    completedTasks.forEach(task => {
        const taskDocRef = doc(firestore, 'clients', clientId, 'projects', projectId, 'tasks', task.id);
        batch.delete(taskDocRef);
    });
    try {
        await batch.commit();
    } catch (error) {
        console.error("Error clearing completed tasks: ", error);
    }
  };

  return (
    <div className="bg-black rounded-[2rem] border border-white/5 p-8 shadow-2xl h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <ListChecks className="h-6 w-6 text-zinc-400" />
        <h2 className="text-2xl font-semibold">Pendientes del Proyecto</h2>
      </div>
      <form onSubmit={handleAddTask} className="flex items-center gap-2 mb-6">
        <Input
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          placeholder="Añadir nueva tarea..."
          className="bg-white/5 border-white/10 focus:border-cyan-500 flex-1"
          disabled={isSubmitting}
        />
        <ShinyButton type="submit" className="!p-0 w-10 h-10 flex-shrink-0" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <Plus className="h-5 w-5" />}
        </ShinyButton>
      </form>
      
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 min-h-[200px]">
        {loading ? (
             <div className="flex items-center justify-center h-full text-zinc-500">
                <LoaderCircle className="h-6 w-6 animate-spin mr-2" />
                Cargando tareas...
             </div>
        ) : tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-zinc-500">
                <p>No hay pendientes en este proyecto.</p>
            </div>
        ) : (
            tasks.map(task => (
              <div key={task.id} className="group flex items-center justify-between gap-3 p-3 bg-white/5 rounded-lg transition-all">
                <div className="flex items-center gap-4">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                    className="border-zinc-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                  />
                  <label 
                    htmlFor={`task-${task.id}`} 
                    className={cn("transition-all cursor-pointer", task.completed && "line-through opacity-40")}
                  >
                    {task.text}
                  </label>
                </div>
                 <Button variant="ghost" size="icon" className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 className="h-4 w-4"/>
                </Button>
              </div>
            ))
        )}
      </div>

      {tasks.some(task => task.completed) && (
        <div className="mt-6 border-t border-white/10 pt-4">
             <Button variant="ghost" className="w-full text-zinc-500 hover:text-red-500" onClick={handleClearCompleted}>
                <Trash2 className="h-4 w-4 mr-2"/>
                Limpiar Completados
            </Button>
        </div>
      )}
    </div>
  );
}
