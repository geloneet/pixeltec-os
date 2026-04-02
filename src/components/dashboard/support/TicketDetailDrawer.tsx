'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { X, LoaderCircle, Edit2, Save, CalendarIcon, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Ticket } from '@/app/dashboard/support/page';
import { createActivityLog } from '@/utils/createLog';

interface TicketDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
}

const ticketStatuses: { value: Ticket['estado'], label: string }[] = [{ value: "Abierto", label: "Abierto" }, { value: "En proceso", label: "En proceso" }, { value: "Esperando cliente", label: "Esperando cliente" }, { value: "Resuelto", label: "Resuelto" }];
const ticketPriorities: { value: Ticket['prioridad'], label: string }[] = [{ value: "Baja", label: "Baja" }, { value: "Media", label: "Media" }, { value: "Alta", label: "Alta" }];

export default function TicketDetailDrawer({ isOpen, onClose, ticketId }: TicketDetailDrawerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [editedSolution, setEditedSolution] = useState('');
  const [isEditingSolution, setIsEditingSolution] = useState(false);

  useEffect(() => {
    if (isOpen && firestore && ticketId) {
      setLoading(true);
      const ticketRef = doc(firestore, 'tickets', ticketId);
      const unsubscribe = onSnapshot(ticketRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Ticket;
          setTicket(data);
          setEditedSolution(data.solucionAplicada || '');
        } else {
          setTicket(null);
          toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el ticket.' });
          onClose();
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching ticket details: ", error);
        setLoading(false);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el ticket.' });
      });
      return () => unsubscribe();
    } else {
      setTicket(null);
    }
  }, [isOpen, firestore, ticketId, toast, onClose]);

  const handleUpdate = async (field: keyof Ticket, value: any) => {
    if (!firestore || !ticket) return;
    const ticketRef = doc(firestore, 'tickets', ticket.id);
    try {
      await updateDoc(ticketRef, { [field]: value });

      if (field === 'estado') {
        await createActivityLog(firestore, {
            type: 'support',
            message: `El estado del ticket #${ticket.ticketId} cambió a: ${value}.`,
            link: `/dashboard/support`
        });
      }

      toast({ title: 'Éxito', description: `Campo '${field}' actualizado.` });
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      toast({ variant: 'destructive', title: 'Error', description: `No se pudo actualizar el campo '${field}'.` });
    }
  };
  
  const handleSaveSolution = async () => {
      if (editedSolution.trim() && editedSolution !== ticket?.solucionAplicada) {
        await handleUpdate('solucionAplicada', editedSolution);
        if(firestore && ticket) {
             await createActivityLog(firestore, {
                type: 'support',
                message: `Se añadió una solución al ticket #${ticket.ticketId} (${ticket.cliente}).`,
                link: `/dashboard/support`
            });
        }
      }
      setIsEditingSolution(false);
  }

  const renderDetail = (label: string, value: React.ReactNode) => (
    <div>
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-base text-zinc-200 mt-1">{value || 'N/A'}</p>
    </div>
  );

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-all duration-300',
        isOpen ? 'visible' : 'invisible'
      )}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Panel */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-xl bg-[#09090b] border-l border-white/10 shadow-2xl transition-transform duration-500 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            <LoaderCircle className="h-8 w-8 animate-spin mr-4" /> Cargando ticket...
          </div>
        ) : !ticket ? (
            <div className="flex h-full items-center justify-center text-red-400">
                Ticket no encontrado.
            </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex-shrink-0 flex items-start justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-2xl font-bold text-white">{ticket.ticketId}</h2>
                <p className="text-zinc-400">{ticket.cliente}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Status & Priority */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Estado</Label>
                        <Combobox 
                            data={ticketStatuses} 
                            value={ticket.estado} 
                            setValue={(val) => handleUpdate('estado', val)} 
                            placeholder="Seleccionar estado..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Prioridad</Label>
                        <Combobox 
                            data={ticketPriorities} 
                            value={ticket.prioridad} 
                            setValue={(val) => handleUpdate('prioridad', val)} 
                            placeholder="Seleccionar prioridad..."
                        />
                    </div>
                </div>

                {renderDetail("Categoría", ticket.categoría)}

                <div className="grid grid-cols-2 gap-6">
                    {renderDetail("Fecha de Apertura", ticket.createdAt ? formatDistanceToNow(ticket.createdAt.toDate(), { addSuffix: true, locale: es }) : 'N/A')}
                    {renderDetail("Fecha de Cierre", ticket.fechaCierre ? formatDistanceToNow(ticket.fechaCierre.toDate(), { addSuffix: true, locale: es }) : 'Pendiente')}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="problema">Problema Reportado</Label>
                    <div className="prose prose-invert prose-sm min-h-[100px] w-full rounded-md border border-transparent bg-black/30 p-3 text-zinc-300 whitespace-pre-wrap">
                        {ticket.problema}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="solucion">Solución Aplicada</Label>
                        {isEditingSolution ? (
                            <Button size="sm" variant="ghost" onClick={handleSaveSolution} className="text-cyan-400 hover:text-cyan-300">
                                <Save className="h-4 w-4 mr-2" /> Guardar
                            </Button>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => setIsEditingSolution(true)} className="text-zinc-400 hover:text-white">
                                <Edit2 className="h-4 w-4 mr-2" /> Editar
                            </Button>
                        )}
                    </div>
                    {isEditingSolution ? (
                         <Textarea
                            id="solucion"
                            value={editedSolution}
                            onChange={(e) => setEditedSolution(e.target.value)}
                            className="bg-black/50 min-h-[150px] focus:border-cyan-500"
                            rows={6}
                            placeholder="Describe aquí los pasos que se siguieron para resolver la incidencia..."
                        />
                    ) : (
                        <div className="prose prose-invert prose-sm min-h-[150px] w-full rounded-md border border-transparent bg-black/30 p-3 text-zinc-300 whitespace-pre-wrap">
                            {ticket.solucionAplicada || <span className="text-zinc-500">Aún no se ha documentado una solución.</span>}
                        </div>
                    )}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
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
