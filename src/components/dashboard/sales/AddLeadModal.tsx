'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { createActivityLog } from '@/utils/createLog';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStage?: string;
}

const serviceOptions = [ { value: "Página web", label: "Página web" }, { value: "Marketing digital", label: "Marketing digital" }, { value: "Automatización", label: "Automatización" }, { value: "Soporte técnico", label: "Soporte técnico" }, { value: "Consultoría", label: "Consultoría" }, { value: "Otro", label: "Otro" } ];
const probabilityOptions = [ { value: "25", label: "Baja (25%)" }, { value: "50", label: "Media (50%)" }, { value: "90", label: "Alta (90%)" } ];
const sourceOptions = [ { value: "Facebook", label: "Facebook" }, { value: "WhatsApp", label: "WhatsApp" }, { value: "Referido", label: "Referido" }, { value: "Google", label: "Google" }, { value: "Página web", label: "Página web" } ];

const initialFormState = {
    companyName: '',
    contactName: '',
    contactEmail: '',
    whatsapp: '',
    interestedService: '',
    estimatedValue: '',
    closeProbability: '',
    leadSource: '',
    notes: ''
};

export default function AddLeadModal({ isOpen, onClose, defaultStage }: AddLeadModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const resetForm = () => setFormData(initialFormState);

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || isSubmitting) return;
        setIsSubmitting(true);

        try {
            const leadsCollection = collection(firestore, 'leads');
            await addDoc(leadsCollection, {
                ...formData,
                estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : 0,
                closeProbability: formData.closeProbability ? parseInt(formData.closeProbability) : 0,
                stage: defaultStage || 'Lead nuevo',
                createdAt: serverTimestamp(),
            });

            await createActivityLog(firestore, {
                type: 'sale',
                message: `Nuevo lead registrado: ${formData.companyName}`,
                link: `/dashboard/pipeline`
            });
            
            toast({ title: 'Éxito', description: 'El nuevo lead ha sido añadido al pipeline.' });
            handleClose();
        } catch (error) {
            console.error("Error adding lead:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el lead.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Añadir Nuevo Lead</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-3">
                    
                    <div className="space-y-2"><Label htmlFor="companyName">Empresa</Label><Input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} className="bg-black/50" required /></div>
                    <div className="space-y-2"><Label htmlFor="contactName">Contacto</Label><Input id="contactName" name="contactName" value={formData.contactName} onChange={handleChange} className="bg-black/50" required /></div>
                    <div className="space-y-2"><Label htmlFor="contactEmail">Email</Label><Input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleChange} className="bg-black/50" /></div>
                    <div className="space-y-2"><Label htmlFor="whatsapp">WhatsApp</Label><Input id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="bg-black/50" /></div>
                    
                    <div className="space-y-2"><Label>Servicio Interesado</Label><Combobox data={serviceOptions} value={formData.interestedService} setValue={(val) => handleSelectChange('interestedService', val)} placeholder="Seleccionar servicio..."/></div>
                    <div className="space-y-2"><Label>Fuente del Lead</Label><Combobox data={sourceOptions} value={formData.leadSource} setValue={(val) => handleSelectChange('leadSource', val)} placeholder="Seleccionar fuente..."/></div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="estimatedValue">Valor Estimado</Label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 text-sm">MX$</span>
                            <Input id="estimatedValue" name="estimatedValue" type="number" value={formData.estimatedValue} onChange={handleChange} className="bg-black/50 pl-12"/>
                        </div>
                    </div>
                    <div className="space-y-2"><Label>Probabilidad de Cierre</Label><Combobox data={probabilityOptions} value={formData.closeProbability} setValue={(val) => handleSelectChange('closeProbability', val)} placeholder="Seleccionar probabilidad..."/></div>
                    
                    <div className="md:col-span-2 space-y-2"><Label htmlFor="notes">Necesidad Detectada / Notas</Label><Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className="bg-black/50 min-h-[100px]"/></div>

                </form>
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-lime-400 text-black font-bold hover:bg-lime-300">
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : "Guardar Lead"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Combobox({ data, value, setValue, placeholder }: { data: { value: string, label: string }[], value: string, setValue: (value: string) => void, placeholder: string }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between bg-black/50 border-white/10 hover:bg-black/70 hover:text-white">
                    {value ? data.find((item) => item.value === value)?.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder={placeholder} />
                    <CommandEmpty>No se encontró.</CommandEmpty>
                    <CommandGroup>
                        <CommandList>
                            {data.map((item) => (
                                <CommandItem key={item.value} value={item.value} onSelect={(currentValue) => { setValue(currentValue === value ? "" : currentValue); setOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                                    {item.label}
                                </CommandItem>
                            ))}
                        </CommandList>
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
