'use client';

import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { X, LoaderCircle, Link as LinkIcon, Trash2, CalendarIcon, ChevronsUpDown, Check, Edit2, Save, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { generateQuotePDF } from '@/utils/generateQuotePDF';

interface ProjectDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  projectId: string;
}

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  startDate?: any;
  estimatedDeliveryDate?: any;
  assignedTo: string;
  comments?: string;
  documents?: string[];
}

interface Client {
  companyName: string;
  contactName: string;
  location: string;
}

const projectStatuses = [{ value: "Planeación", label: "Planeación" }, { value: "En desarrollo", label: "En desarrollo" }, { value: "En revisión", label: "En revisión" }, { value: "Entregado", label: "Entregado" }, { value: "Cancelado", label: "Cancelado" }];
const projectPriorities = [{ value: "Baja", label: "Baja" }, { value: "Media", label: "Media" }, { value: "Alta", label: "Alta" }, { value: "Urgente", label: "Urgente" }];

export default function ProjectDetailDrawer({ isOpen, onClose, clientId, projectId }: ProjectDetailDrawerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [newLink, setNewLink] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  
  const [editedComments, setEditedComments] = useState('');
  const [isEditingComments, setIsEditingComments] = useState(false);

  useEffect(() => {
    if (isOpen && firestore && clientId && projectId) {
      setLoading(true);
      const projectRef = doc(firestore, 'clients', clientId, 'projects', projectId);
      const unsubscribe = onSnapshot(projectRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Project;
          setProject(data);
          setEditedComments(data.comments || '');
        } else {
          setProject(null);
          toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el proyecto.' });
          onClose();
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching project details: ", error);
        setLoading(false);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el proyecto.' });
      });
      return () => unsubscribe();
    } else {
      setProject(null);
    }
  }, [isOpen, firestore, clientId, projectId, toast, onClose]);

  useEffect(() => {
    if (isOpen && firestore && clientId) {
      const clientRef = doc(firestore, 'clients', clientId);
      const unsubscribe = onSnapshot(clientRef, (docSnap) => {
        if (docSnap.exists()) {
          setClient(docSnap.data() as Client);
        } else {
          console.error("Client not found for PDF generation");
          setClient(null);
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen, firestore, clientId]);

  const handleUpdate = async (field: keyof Project, value: any) => {
    if (!firestore || !project) return;
    const projectRef = doc(firestore, 'clients', clientId, 'projects', project.id);
    try {
      await updateDoc(projectRef, { [field]: value });
      toast({ title: 'Éxito', description: `Campo '${field}' actualizado.` });
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      toast({ variant: 'destructive', title: 'Error', description: `No se pudo actualizar el campo '${field}'.` });
    }
  };
  
  const handleSaveComments = async () => {
      await handleUpdate('comments', editedComments);
      setIsEditingComments(false);
  }

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !project || !newLink.trim()) return;
    setIsAddingLink(true);
    const projectRef = doc(firestore, 'clients', clientId, 'projects', project.id);
    try {
      await updateDoc(projectRef, { documents: arrayUnion(newLink) });
      setNewLink('');
    } catch (error) {
      console.error("Error adding link: ", error);
    } finally {
      setIsAddingLink(false);
    }
  };

  const handleRemoveLink = async (linkToRemove: string) => {
    if (!firestore || !project) return;
    const projectRef = doc(firestore, 'clients', clientId, 'projects', project.id);
    await updateDoc(projectRef, { documents: arrayRemove(linkToRemove) });
  };
  
  const handleGenerateQuote = async () => {
    if (!client || !project) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Faltan datos del cliente o del proyecto para generar la cotización.',
      });
      return;
    }

    const quoteItemsData = [
      { description: 'Desarrollo Frontend y Arquitectura con Next.js', quantity: 1, unitPrice: 25000, total: 25000 },
      { description: 'Configuración de Base de Datos y Backend (Firebase)', quantity: 1, unitPrice: 15000, total: 15000 },
      { description: 'Diseño de Interfaz de Usuario (UI/UX) en Figma', quantity: 1, unitPrice: 12000, total: 12000 },
    ];

    try {
      await generateQuotePDF(client, project, quoteItemsData);
      toast({ title: 'Éxito', description: 'La cotización PDF se ha generado correctamente.' });
    } catch(error) {
        console.error("Error al generar el PDF:", error);
        toast({ variant: 'destructive', title: 'Error de PDF', description: 'No se pudo generar la cotización. Revisa la consola para más detalles.' });
    }
  };

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
            <LoaderCircle className="h-8 w-8 animate-spin mr-4" /> Cargando proyecto...
          </div>
        ) : !project ? (
            <div className="flex h-full items-center justify-center text-red-400">
                Proyecto no encontrado.
            </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">{project.name}</h2>
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
                            data={projectStatuses} 
                            value={project.status} 
                            setValue={(val) => handleUpdate('status', val)} 
                            placeholder="Seleccionar estado..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Prioridad</Label>
                        <Combobox 
                            data={projectPriorities} 
                            value={project.priority} 
                            setValue={(val) => handleUpdate('priority', val)} 
                            placeholder="Seleccionar prioridad..."
                        />
                    </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Fecha de Inicio</Label>
                        <DatePicker date={project.startDate?.toDate()} setDate={(d) => handleUpdate('startDate', d)}/>
                    </div>
                    <div className="space-y-2">
                        <Label>Entrega Estimada</Label>
                        <DatePicker date={project.estimatedDeliveryDate?.toDate()} setDate={(d) => handleUpdate('estimatedDeliveryDate', d)}/>
                    </div>
                </div>

              {/* Comments */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="comments">Comentarios / Bitácora</Label>
                        {isEditingComments ? (
                            <Button size="sm" variant="ghost" onClick={handleSaveComments} className="text-cyan-400 hover:text-cyan-300">
                                <Save className="h-4 w-4 mr-2" /> Guardar
                            </Button>
                        ) : (
                            <Button size="sm" variant="ghost" onClick={() => setIsEditingComments(true)} className="text-zinc-400 hover:text-white">
                                <Edit2 className="h-4 w-4 mr-2" /> Editar
                            </Button>
                        )}
                    </div>
                    {isEditingComments ? (
                         <Textarea
                            id="comments"
                            value={editedComments}
                            onChange={(e) => setEditedComments(e.target.value)}
                            className="bg-black/50 min-h-[120px] focus:border-cyan-500"
                            rows={5}
                        />
                    ) : (
                        <div className="prose prose-invert prose-sm min-h-[120px] w-full rounded-md border border-transparent bg-black/30 p-3 text-zinc-300 whitespace-pre-wrap">
                            {project.comments || <span className="text-zinc-500">No hay comentarios.</span>}
                        </div>
                    )}
                </div>

              {/* Attached Documents */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2">
                     <FileText className="h-5 w-5 text-zinc-400" />
                     <h3 className="font-semibold text-zinc-200">Documentos Adjuntos</h3>
                </div>
                <form onSubmit={handleAddLink} className="flex items-center gap-2">
                  <Input
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="Pega aquí un enlace de Figma, Drive, etc."
                    className="bg-black/50"
                    disabled={isAddingLink}
                  />
                  <Button type="submit" size="icon" disabled={isAddingLink || !newLink.trim()}>
                    {isAddingLink ? <LoaderCircle className="animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                  </Button>
                </form>
                <ul className="space-y-2">
                  {project.documents?.map((link, index) => (
                    <li key={index} className="group flex items-center justify-between gap-2 p-2 bg-white/5 rounded-md text-sm">
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline truncate flex-1">
                        {link}
                      </a>
                      <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7" onClick={() => handleRemoveLink(link)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                   {project.documents?.length === 0 && <p className="text-xs text-zinc-500 text-center py-2">No hay documentos adjuntos.</p>}
                </ul>
              </div>

               {/* PDF Quote Generation */}
              <div className="space-y-4 pt-8 border-t border-white/10">
                 <div className="flex items-center gap-2">
                     <FileText className="h-5 w-5 text-zinc-400" />
                     <h3 className="font-semibold text-zinc-200">Gestión de Cotización</h3>
                </div>
                <p className="text-xs text-zinc-500">
                    Genera un documento PDF profesional con los detalles del proyecto y una cotización de ejemplo. Los items de la cotización son simulados por ahora.
                </p>
                <Button 
                    onClick={handleGenerateQuote}
                    className="w-full h-12 text-base font-bold bg-white/5 text-white border border-transparent hover:border-cyan-500 hover:text-cyan-400 hover:bg-cyan-900/20 transition-all duration-300"
                    disabled={!client || !project}
                >
                    📄 Descargar Cotización PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function DatePicker({ date, setDate }: { date?: Date, setDate: (date?: Date) => void }) {
    const [open, setOpen] = useState(false);

    const handleSelect = (newDate: Date | undefined) => {
        setDate(newDate);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-black/50 border-white/10 hover:bg-black/70 hover:text-white", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={handleSelect} initialFocus /></PopoverContent>
        </Popover>
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
