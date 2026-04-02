'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
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
import { sendTicketEmailAction } from '@/app/actions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AddTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultState?: string;
}

const categoryOptions = [ { value: "Hosting", label: "Hosting" }, { value: "Página web", label: "Página web" }, { value: "Correo", label: "Correo" }, { value: "Automatización", label: "Automatización" }, { value: "Hardware", label: "Hardware" }, { value: "Otro", label: "Otro" }];
const priorityOptions = [ { value: "Baja", label: "Baja" }, { value: "Media", label: "Media" }, { value: "Alta", label: "Alta" } ];

const initialFormState = {
    cliente: '',
    problema: '',
    categoría: 'Página web',
    prioridad: 'Media',
};

interface Client {
    id: string;
    companyName: string;
}

export default function AddTicketModal({ isOpen, onClose, defaultState }: AddTicketModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [formData, setFormData] = useState(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);

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

    useEffect(() => {
        if (!isOpen || !firestore) return;

        const fetchClients = async () => {
            setLoadingClients(true);
            try {
                const clientsQuery = query(collection(firestore, 'clients'), orderBy('companyName', 'asc'));
                const querySnapshot = await getDocs(clientsQuery);
                const clientsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    companyName: doc.data().companyName
                } as Client));
                setClients(clientsData);
            } catch (error) {
                console.error("Error fetching clients: ", error);
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.' });
            } finally {
                setLoadingClients(false);
            }
        };

        fetchClients();
    }, [isOpen, firestore, toast]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || isSubmitting) return;
        setIsSubmitting(true);

        try {
            const ticketsCollection = collection(firestore, 'tickets');
            
            const ticketCountSnapshot = await getDocs(ticketsCollection);
            const ticketNumber = (ticketCountSnapshot.size + 1).toString().padStart(3, '0');
            const ticketId = `TKT-${ticketNumber}`;

            await addDoc(ticketsCollection, {
                ...formData,
                ticketId,
                estado: defaultState || 'Abierto',
                createdAt: serverTimestamp(),
            });

            await createActivityLog(firestore, {
                type: 'support',
                message: `Nuevo ticket de soporte: ${ticketId}`,
                link: '/dashboard/support'
            });

            // Fire ticket notification email — non-blocking
            sendTicketEmailAction({
                ticketId,
                cliente:   formData.cliente,
                problema:  formData.problema,
                categoria: formData.categoría,
                prioridad: formData.prioridad as 'Baja' | 'Media' | 'Alta',
                createdAt: format(new Date(), "d 'de' MMMM, yyyy · HH:mm", { locale: es }),
            }).catch(console.error);

            toast({ title: 'Éxito', description: `Ticket ${ticketId} ha sido creado.` });
            handleClose();
        } catch (error) {
            console.error("Error adding ticket:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el ticket.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const clientOptions = clients.map(client => ({
        value: client.companyName,
        label: client.companyName,
    }));

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Levantar Nuevo Ticket</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-3">
                    
                    <div className="space-y-2">
                        <Label htmlFor="cliente">Cliente</Label>
                        <Combobox 
                            data={clientOptions} 
                            value={formData.cliente} 
                            setValue={(val) => handleSelectChange('cliente', val)} 
                            placeholder={loadingClients ? "Cargando clientes..." : "Seleccionar un cliente..."}
                            disabled={loadingClients}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Categoría</Label><Combobox data={categoryOptions} value={formData.categoría} setValue={(val) => handleSelectChange('categoría', val)} placeholder="Seleccionar categoría..."/></div>
                        <div className="space-y-2"><Label>Prioridad</Label><Combobox data={priorityOptions} value={formData.prioridad} setValue={(val) => handleSelectChange('prioridad', val)} placeholder="Seleccionar prioridad..."/></div>
                    </div>
                    
                    <div className="space-y-2"><Label htmlFor="problema">Descripción del Problema</Label><Textarea id="problema" name="problema" value={formData.problema} onChange={handleChange} className="bg-black/50 min-h-[120px]" required /></div>

                </form>
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting || !formData.cliente} className="bg-cyan-500 text-black font-bold hover:bg-cyan-400">
                        {isSubmitting ? <LoaderCircle className="animate-spin" /> : "Crear Ticket"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Combobox({ data, value, setValue, placeholder, disabled = false }: { data: { value: string, label: string }[], value: string, setValue: (value: string) => void, placeholder: string, disabled?: boolean }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between bg-black/50 border-white/10 hover:bg-black/70 hover:text-white" disabled={disabled}>
                    {value ? data.find((item) => item.value === value)?.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandEmpty>No se encontró el cliente.</CommandEmpty>
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
