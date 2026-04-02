'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Trash2, LoaderCircle, MessageSquareText, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { sendTelegramNotification } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: any;
}

interface NotesLogProps {
  clientId: string;
  projectId: string;
  clientName: string;
  notes: Note[];
  loading: boolean;
}

export default function NotesLog({ clientId, projectId, clientName, notes, loading }: NotesLogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notifyByTelegram, setNotifyByTelegram] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !newNoteContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const notesCollectionRef = collection(firestore, 'clients', clientId, 'projects', projectId, 'notes');
      await addDoc(notesCollectionRef, {
        content: newNoteContent,
        author: 'Miguel Robles',
        createdAt: serverTimestamp(),
      });

      if (notifyByTelegram) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const clientUrl = appUrl ? `${appUrl}/dashboard/clients/${clientId}` : 'No disponible';
        const message = `📝 *Nueva Nota en ${clientName}:*\n\n${newNoteContent}\n\n[Ver en PixelTEC OS](${clientUrl})`;
        
        sendTelegramNotification(message).then(result => {
          if (result.success) {
            toast({
                title: "Nota Enviada a Telegram",
                description: "La nota ha sido notificada exitosamente."
            });
          } else {
            toast({
                variant: 'destructive',
                title: "Error de Notificación",
                description: result.error || "No se pudo enviar la nota a Telegram."
            });
          }
        });

        setNotifyByTelegram(false); // Reset switch
      }

      setNewNoteContent('');
    } catch (error) {
      console.error("Error adding note: ", error);
       toast({
            variant: 'destructive',
            title: "Error al guardar",
            description: "No se pudo guardar la nota en la base de datos."
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!firestore) return;
    const noteDocRef = doc(firestore, 'clients', clientId, 'projects', projectId, 'notes', noteId);
    try {
      await deleteDoc(noteDocRef);
    } catch (error) {
      console.error("Error deleting note: ", error);
    }
  };

  return (
    <div className="bg-black rounded-[2rem] border border-white/5 p-8 shadow-2xl h-full flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <MessageSquareText className="h-6 w-6 text-zinc-400" />
        <h2 className="text-2xl font-semibold">Bitácora de Notas</h2>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4 mb-6 min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <LoaderCircle className="h-6 w-6 animate-spin mr-2" />
            Cargando bitácora...
          </div>
        ) : notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <p>No hay notas en la bitácora de este proyecto.</p>
          </div>
        ) : (
          notes.map(note => (
            <div key={note.id} className="group relative bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-zinc-300 whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                <p className="text-xs text-zinc-500">
                  <span className="font-semibold">{note.author}</span> • {note.createdAt ? formatDistanceToNow(note.createdAt.toDate(), { addSuffix: true, locale: es }) : 'justo ahora'}
                </p>
                <Button variant="ghost" size="icon" className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" onClick={() => handleDeleteNote(note.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <form onSubmit={handleAddNote} className="flex flex-col gap-3">
        <Textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Escribe aquí las notas, avances y próximos pasos del proyecto..."
          className="w-full min-h-24 bg-white/5 border-white/10 rounded-xl p-4 text-zinc-300 placeholder:text-zinc-500 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
          disabled={isSubmitting}
        />
        <div className="flex justify-between items-center mt-2">
            <div className="flex items-center space-x-2">
                <Switch
                    id="telegram-notify"
                    checked={notifyByTelegram}
                    onCheckedChange={setNotifyByTelegram}
                    disabled={isSubmitting || !newNoteContent.trim()}
                />
                <Label htmlFor="telegram-notify" className="text-sm text-zinc-400 flex items-center gap-2 cursor-pointer">
                    <Send className="h-4 w-4" />
                    Notificar Urgente
                </Label>
            </div>
            <ShinyButton type="submit" className="w-full sm:w-auto self-end" disabled={isSubmitting || !newNoteContent.trim()}>
              {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : 'Guardar Nota'}
            </ShinyButton>
        </div>
      </form>
    </div>
  );
}
