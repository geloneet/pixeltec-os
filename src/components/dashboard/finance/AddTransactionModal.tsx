'use client';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, ChevronsUpDown, Check, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { createActivityLog } from '@/utils/createLog';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeOptions = [ { value: "Mensual", label: "Mensual" }, { value: "Único", label: "Único" }];
const statusOptions = [ { value: "Pagado", label: "Pagado" }, { value: "Pendiente", label: "Pendiente" }];
const methodOptions = [ { value: "Transferencia", label: "Transferencia" }, { value: "Efectivo", label: "Efectivo" }, { value: "Stripe", label: "Stripe" }, { value: "MercadoPago", label: "MercadoPago" } ];

const initialFormState = {
    clientName: '',
    projectName: '',
    amount: '',
    type: 'Único',
    status: 'Pendiente',
    method: 'Transferencia',
};

interface Client {
    id: string;
    companyName: string;
}

export default function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [formData, setFormData] = useState(initialFormState);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [datePopoverOpen, setDatePopoverOpen] = useState(false);

    const resetForm = () => {
        setFormData(initialFormState);
        setDate(new Date());
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateSelect = (selectedDate?: Date) => {
        setDate(selectedDate);
        setDatePopoverOpen(false);
    };

    useEffect(() => {
        if (!isOpen || !firestore) return;
        const fetchClients = async () => {
            setLoadingClients(true);
            try {
                const clientsQuery = query(collection(firestore, 'clients'), orderBy('companyName', 'asc'));
                const querySnapshot = await getDocs(clientsQuery);
                setClients(querySnapshot.docs.map(doc => ({ id: doc.id, companyName: doc.data().companyName } as Client)));
            } catch (error) { console.error("Error fetching clients: ", error); }
            finally { setLoadingClients(false); }
        };
        fetchClients();
    }, [isOpen, firestore]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || isSubmitting || !date) return;
        setIsSubmitting(true);

        try {
            await addDoc(collection(firestore, 'finances'), {
                ...formData,
                amount: parseFloat(formData.amount) || 0,
                date: date,
                createdAt: serverTimestamp(),
            });

            await createActivityLog(firestore, {
                type: 'finance',
                message: `Pago registrado de ${formData.clientName}`,
                link: '/dashboard/finance'
            });

            toast({ title: 'Éxito', description: 'La transacción ha sido registrada.' });
            handleClose();
        } catch (error) {
            console.error("Error adding transaction:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la transacción.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const clientOptions = clients.map(client => ({ value: client.companyName, label: client.companyName }));

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-2xl">
                <DialogHeader><DialogTitle className="text-2xl font-bold">Registrar Transacción</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-3">
                    <div className="space-y-2"><Label>Cliente</Label><Combobox data={clientOptions} value={formData.clientName} setValue={(val) => handleSelectChange('clientName', val)} placeholder="Seleccionar cliente..." disabled={loadingClients}/></div>
                    <div className="space-y-2"><Label htmlFor="projectName">Proyecto</Label><Input id="projectName" name="projectName" value={formData.projectName} onChange={handleChange} className="bg-black/50" /></div>
                    <div className="space-y-2"><Label htmlFor="amount">Monto</Label><div className="relative"><span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 text-sm">MX$</span><Input id="amount" name="amount" type="number" value={formData.amount} onChange={handleChange} className="bg-black/50 pl-12" required /></div></div>
                    <div className="space-y-2"><Label>Fecha</Label><Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}><PopoverTrigger asChild><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-black/50", !date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : <span>Elige una fecha</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus /></PopoverContent></Popover></div>
                    <div className="space-y-2"><Label>Tipo</Label><Combobox data={typeOptions} value={formData.type} setValue={(val) => handleSelectChange('type', val)} placeholder="Tipo de ingreso..."/></div>
                    <div className="space-y-2"><Label>Estado</Label><Combobox data={statusOptions} value={formData.status} setValue={(val) => handleSelectChange('status', val)} placeholder="Estado del pago..."/></div>
                    <div className="md:col-span-2 space-y-2"><Label>Método de Pago</Label><Combobox data={methodOptions} value={formData.method} setValue={(val) => handleSelectChange('method', val)} placeholder="Método de pago..."/></div>
                </form>
                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting} className="bg-lime-400 text-black font-bold hover:bg-lime-300">{isSubmitting ? <LoaderCircle className="animate-spin" /> : "Guardar Transacción"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Combobox({ data, value, setValue, placeholder, disabled = false }: { data: { value: string, label: string }[], value: string, setValue: (value: string) => void, placeholder: string, disabled?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between bg-black/50 border-white/10 hover:bg-black/70 hover:text-white" disabled={disabled}>{value ? data.find((item) => item.value === value)?.label : placeholder}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command><CommandInput placeholder="Buscar..." /><CommandEmpty>No se encontró.</CommandEmpty><CommandGroup><CommandList>
                    {data.map((item) => (<CommandItem key={item.value} value={item.value} onSelect={(currentValue) => { setValue(currentValue === value ? "" : currentValue); setOpen(false); }}><Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />{item.label}</CommandItem>))}
                </CommandList></CommandGroup></Command>
            </PopoverContent>
        </Popover>
    );
}
