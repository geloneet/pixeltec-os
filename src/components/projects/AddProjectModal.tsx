'use client';

import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

interface AddProjectModalProps {
  clientId: string;
  onClose: () => void;
}

export default function AddProjectModal({ clientId, onClose }: AddProjectModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
    projectType: 'Web',
    projectStatus: 'Planeación',
    priority: 'Media',
    assignee: 'Miguel Robles',
    comments: ''
  });
  const firestore = useFirestore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore) return;
    setLoading(true);

    try {
      // Apuntamos a la sub-colección de proyectos de este cliente específico
      const projectsRef = collection(firestore, `clients/${clientId}/projects`);
      
      await addDoc(projectsRef, {
        ...formData,
        startDate: serverTimestamp(),
        documents: [], // Arreglo vacío listo para recibir enlaces después
        createdAt: serverTimestamp()
      });

      onClose(); // Cerramos el modal tras guardar con éxito
    } catch (error) {
      console.error("Error al crear el proyecto:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#09090b] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Nuevo Proyecto</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nombre del Proyecto */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Nombre del proyecto</label>
            <input 
              required
              name="projectName"
              type="text" 
              placeholder="Ej. ERP de Logística"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 transition-colors text-sm"
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tipo de Proyecto */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Tipo</label>
              <select 
                name="projectType"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                onChange={handleChange}
              >
                <option value="Web">Web</option>
                <option value="Automatización">Automatización</option>
                <option value="Marketing">Marketing</option>
                <option value="App">App</option>
              </select>
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Prioridad</label>
              <select 
                name="priority"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                onChange={handleChange}
                defaultValue="Media"
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Estado Inicial */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Estado</label>
              <select 
                name="projectStatus"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                onChange={handleChange}
              >
                <option value="Planeación">Planeación</option>
                <option value="En desarrollo">En desarrollo</option>
              </select>
            </div>

            {/* Responsable */}
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Responsable</label>
              <input 
                name="assignee"
                type="text" 
                defaultValue="Miguel Robles"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Comentarios */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Comentarios iniciales (Opcional)</label>
            <textarea 
              name="comments"
              rows={3}
              placeholder="Notas sobre el alcance del proyecto..."
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500 text-sm resize-none"
              onChange={handleChange}
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 text-sm font-medium text-black bg-gradient-to-r from-cyan-500 to-lime-400 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
