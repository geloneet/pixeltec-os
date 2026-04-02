'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createActivityLog } from '@/utils/createLog';
import { sendTaskEmailAction } from '@/app/actions';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const responsibleOptions = ["Miguel Robles", "Asistente"];
const statusOptions = ["Pendiente", "En proceso"];

const initialFormState = {
    title: '',
    responsible: 'Miguel Robles',
    status: 'Pendiente',
};

export default function AddTaskModal({ isOpen, onClose }: AddTaskModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [formData, setFormData] = useState(initialFormState);
    const [dueDate, setDueDate] = useState<Date | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setFormData(initialFormState);
        setDueDate(undefined);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleDateSelect = (selectedDate?: Date) => {
        setDueDate(selectedDate);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !formData.title.trim() || isSubmitting) return;
        setIsSubmitting(true);

        try {
            await addDoc(collection(firestore, 'tasks'), {
                ...formData,
                dueDate,
                createdAt: serverTimestamp(),
            });

            await createActivityLog(firestore, {
                message: `Nueva tarea global creada: "${formData.title}"`,
                type: 'project',
                link: '/dashboard/tasks'
            });

            // Fire task notification email — non-blocking
            sendTaskEmailAction({
                taskTitle:   formData.title,
                responsible: formData.responsible,
                status:      formData.status,
                dueDate:     dueDate ? format(dueDate, "d 'de' MMMM, yyyy", { locale: es }) : undefined,
            }).catch(console.error);

            toast({ title: 'Éxito', description: 'La nueva tarea ha sido añadida.' });
            handleClose();
        } catch (error) {
            console.error("Error adding task:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la tarea.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-lg">
                <DialogHeader><DialogTitle className="text-2xl font-bold">Nueva Tarea Global</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
                    
                    <div className="space-y-2">
                        <Label htmlFor="title">Título de la tarea</Label>
                        <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="Ej. Configurar nuevo dominio" className="bg-black/50" required />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="responsible">Responsable</Label>
                            <select id="responsible" name="responsible" value={formData.responsible} onChange={handleChange} className="w-full h-10 bg-black/50 border border-input rounded-md px-3 text-sm">
                                {responsibleOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="status">Estado inicial</Label>
                            <select id="status" name="status" value={formData.status} onChange={handleChange} className="w-full h-10 bg-black/50 border border-input rounded-md px-3 text-sm">
                                {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>

                     <div className="space-y-2">
                        <Label>Fecha Límite</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-black/50", !dueDate && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />{dueDate ? format(dueDate, "PPP", {locale: es}) : <span>Elige una fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={dueDate} onSelect={handleDateSelect} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>

                </form>
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    <Button 
                        type="submit" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !formData.title} 
                        className="px-6 py-2 text-sm font-medium text-black bg-gradient-to-r from-cyan-500 to-lime-400 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : "Guardar Tarea"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
