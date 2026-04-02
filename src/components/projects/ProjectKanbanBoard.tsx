'use client';

import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { doc, updateDoc, onSnapshot, collection, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

// Definimos los estados exactos de tu arquitectura
const COLUMNS = ['Planeación', 'En desarrollo', 'En revisión', 'Entregado', 'Cancelado'];

interface Project {
  id: string;
  projectName: string;
  projectType: string;
  projectStatus: string;
  priority: string;
  assignee: string;
  documents?: string[]; // Aquí entran los enlaces a Drive/Figma
}

export default function ProjectKanbanBoard({ clientId }: { clientId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const firestore = useFirestore();

  // Sensores para detectar el clic o el toque en pantallas táctiles
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Cargar proyectos en tiempo real desde Firestore
  useEffect(() => {
    if (!clientId || !firestore) return;
    const q = query(collection(firestore, `clients/${clientId}/projects`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProjects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(loadedProjects);
    });
    return () => unsubscribe();
  }, [clientId, firestore]);

  // Lógica principal: ¿Qué pasa cuando sueltas la tarjeta?
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return; // Si la soltaste fuera del tablero, no hace nada

    const projectId = active.id as string;
    const newStatus = over.id as string; // El ID del contenedor destino (la columna)

    const projectToUpdate = projects.find(p => p.id === projectId);
    
    // Solo actualizamos Firebase si realmente cambió de columna
    if (projectToUpdate && projectToUpdate.projectStatus !== newStatus) {
      // Actualización optimista en la UI para que se sienta instantáneo
      setProjects(prev => 
        prev.map(p => p.id === projectId ? { ...p, projectStatus: newStatus } : p)
      );

      // Guardado real en la base de datos de PIXELTEC
      if (!firestore) return;
      try {
        const projectRef = doc(firestore, `clients/${clientId}/projects`, projectId);
        await updateDoc(projectRef, { projectStatus: newStatus });
      } catch (error) {
        console.error("Error al mover el proyecto:", error);
      }
    }
  };

  return (
    <div className="w-full mt-8 overflow-x-auto pb-4">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-[1200px]">
          {COLUMNS.map((colStatus) => {
            const columnProjects = projects.filter(p => p.projectStatus === colStatus);
            
            return (
              <div key={colStatus} className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 min-h-[500px]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-zinc-300">{colStatus}</h3>
                  <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-zinc-400">
                    {columnProjects.length}
                  </span>
                </div>

                {/* Zona donde se pueden soltar las tarjetas */}
                <SortableContext id={colStatus} items={columnProjects} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-3 h-full">
                    {columnProjects.map((project) => (
                      <div 
                        key={project.id} 
                        className="bg-[#09090b] border border-white/10 p-4 rounded-lg cursor-grab active:cursor-grabbing hover:border-cyan-500/50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-cyan-400 font-medium">{project.projectType}</span>
                          {/* Indicador de Documentos Adjuntos */}
                          {project.documents && project.documents.length > 0 && (
                            <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 flex items-center gap-1">
                              📎 {project.documents.length} docs
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-2">{project.projectName}</h4>
                        <div className="flex justify-between items-center text-xs text-zinc-500">
                          <span>👤 {project.assignee}</span>
                          <span className={`px-2 py-0.5 rounded-full ${project.priority === 'Urgente' ? 'bg-red-500/20 text-red-400' : 'bg-white/5'}`}>
                            {project.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
