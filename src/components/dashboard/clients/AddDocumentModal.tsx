'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createActivityLog } from '@/utils/createLog';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

const CATEGORIES = ['Contratos', 'Facturas', 'Propuestas', 'Credenciales', 'Manual del proyecto'] as const;
type Category = typeof CATEGORIES[number];

const initialFormState = {
    name: '',
    url: '',
    category: 'Contratos' as Category,
};

export default function AddDocumentModal({ isOpen, onClose, clientId, clientName }: AddDocumentModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetForm = () => {
        setFormData(initialFormState);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value as any }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !formData.name.trim() || !formData.url.trim() || isSubmitting) return;

        try {
            new URL(formData.url); // Validate URL format
        } catch (_) {
            toast({ variant: 'destructive', title: 'URL Inválida', description: 'Por favor, introduce una URL válida.' });
            return;
        }

        setIsSubmitting(true);
        const clientRef = doc(firestore, 'clients', clientId);
        const newDocument = {
            name: formData.name,
            url: formData.url,
            category: formData.category,
            uploadDate: serverTimestamp(),
        };

        try {
            await updateDoc(clientRef, {
                documents: arrayUnion(newDocument)
            });

            await createActivityLog(firestore, {
                message: `Se añadió nuevo documento de tipo '${formData.category}' para el cliente ${clientName}.`,
                type: 'project',
                link: `/dashboard/clients/${clientId}`,
            });

            toast({ title: 'Éxito', description: 'Documento añadido a la bóveda.' });
            handleClose();
        } catch (error) {
            console.error("Error adding document: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo añadir el documento.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Añadir Documento a la Bóveda</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre del documento</Label>
                        <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Ej. Contrato 2026 - Fase 1" className="bg-black/50" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="url">URL del archivo</Label>
                        <Input id="url" name="url" type="url" value={formData.url} onChange={handleChange} placeholder="https://..." className="bg-black/50" required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category">Categoría</Label>
                        <select
                            id="category"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="w-full h-10 bg-black/50 border border-input rounded-md px-3 text-sm"
                            required
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </form>
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.url} className="bg-cyan-500 text-black font-bold hover:bg-cyan-400">
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : <><Plus className="h-4 w-4 mr-2" /> Guardar Documento</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
