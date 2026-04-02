'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, orderBy, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import Image from 'next/image';
import {
  ArrowLeft, User, Mail, LoaderCircle, Plus, CalendarIcon, ChevronsUpDown, Check,
  Globe, RefreshCw, Copy, CheckCheck, Send, Sparkles, ImageIcon, Trash2, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ProjectKanbanBoard from '@/components/dashboard/ProjectKanbanBoard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePresentationMode } from '@/context/PresentationModeContext';
import ProjectDetailDrawer from '@/components/dashboard/ProjectDetailDrawer';
import { createActivityLog } from '@/utils/createLog';
import ClientDocumentVault from '@/components/dashboard/clients/ClientDocumentVault';
import { useToast } from '@/hooks/use-toast';
import {
  sendUpdateEmailAction,
  requestPortalCodeAction,
} from '@/app/actions';
import { generateSlug } from '@/lib/portal';


// --- Interfaces ---
interface Document {
  name: string;
  url: string;
  category: 'Contratos' | 'Facturas' | 'Propuestas' | 'Credenciales' | 'Manual del proyecto';
  uploadDate: any;
}
interface Client {
    id: string;
    companyName: string;
    logoUrl?: string;
    contactName: string;
    contactEmail: string;
    techStack: string[];
    status: 'Lead' | 'Activo';
    documents?: Document[];
    slug?: string;
    accessCode?: string | null;
}

interface ClientUpdate {
    id: string;
    text: string;
    imageUrl?: string;
    createdAt: any;
    createdBy: string;
}

interface Project {
    id: string;
    name: string;
    type: 'Web' | 'Automatización' | 'Marketing' | 'App';
    status: 'Planeación' | 'En desarrollo' | 'En revisión' | 'Entregado' | 'Cancelado';
    priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
    startDate: any;
    estimatedDeliveryDate: any;
    assignedTo: string;
}

// --- Main Page Component ---
export default function ClientDetailPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const id = params.id as string;
    const { isPresentationMode } = usePresentationMode();

    const [client, setClient] = useState<Client | null>(null);
    const [loadingClient, setLoadingClient] = useState(true);

    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
    const [defaultProjectStatus, setDefaultProjectStatus] = useState<string>();

    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

    // Portal state
    const [updates, setUpdates] = useState<ClientUpdate[]>([]);
    const [generatingSlug, setGeneratingSlug] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [updateText, setUpdateText] = useState('');
    const [updateImageUrl, setUpdateImageUrl] = useState('');
    const [savingUpdate, setSavingUpdate] = useState(false);

    // Effect for fetching client data
    useEffect(() => {
        if (!firestore || !id) return;
        const docRef = doc(firestore, 'clients', id);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) setClient({ id: docSnap.id, ...docSnap.data() } as Client);
            else setClient(null);
            setLoadingClient(false);
        }, (error) => { console.error("Error fetching client details: ", error); setLoadingClient(false); });
        return () => unsubscribe();
    }, [firestore, id]);

    // Effect for fetching projects
    useEffect(() => {
        if (!firestore || !id) return;
        const projectsQuery = query(collection(firestore, 'clients', id, 'projects'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
            setProjects(projectsData);
            setLoadingProjects(false);
        }, (error) => { console.error("Error fetching projects: ", error); setLoadingProjects(false); });
        return () => unsubscribe();
    }, [firestore, id]);

    // Effect for fetching portal updates
    useEffect(() => {
        if (!firestore || !id) return;
        const updatesQuery = query(
            collection(firestore, 'clients', id, 'updates'),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(updatesQuery, (snapshot) => {
            setUpdates(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ClientUpdate)));
        });
        return () => unsubscribe();
    }, [firestore, id]);

    // Portal handlers
    const handleGenerateSlug = async () => {
        if (!client || !firestore) return;
        setGeneratingSlug(true);
        try {
            const slug = generateSlug(client.companyName);
            await updateDoc(doc(firestore, 'clients', id), { slug });
            toast({ title: '✓ Portal activado', description: slug });
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el slug.' });
        }
        setGeneratingSlug(false);
    };

    const handleSendCode = async () => {
        if (!client?.slug) return;
        setSendingCode(true);
        const res = await requestPortalCodeAction(client.slug);
        if (res.success) {
            toast({ title: '✓ Código enviado', description: `Enviado a ${res.data?.maskedEmail}` });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
        setSendingCode(false);
    };

    const handleCopyLink = () => {
        if (!client?.slug) return;
        const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/${client.slug}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAddUpdate = async () => {
        if (!updateText.trim() || savingUpdate || !firestore) return;
        setSavingUpdate(true);
        const text = updateText.trim();
        const imageUrl = updateImageUrl.trim() || null;
        try {
            await addDoc(collection(firestore, 'clients', id, 'updates'), {
                text,
                imageUrl,
                createdBy: 'Miguel Robles',
                createdAt: serverTimestamp(),
            });
            setUpdateText('');
            setUpdateImageUrl('');
            toast({ title: '✓ Actualización publicada' });
            sendUpdateEmailAction(id, {
                text,
                imageUrl: imageUrl ?? undefined,
                createdBy: 'Miguel Robles',
            }).catch(console.error);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar.' });
        }
        setSavingUpdate(false);
    };

    const handleOpenAddProjectModal = (status?: string) => {
        setDefaultProjectStatus(status);
        setIsAddProjectModalOpen(true);
    };

    const handleCloseDrawer = () => {
        setSelectedProjectId(null);
    }

    if (loadingClient) return <div className="flex items-center justify-center h-full text-zinc-400"><LoaderCircle className="h-8 w-8 animate-spin mr-4" />Cargando datos del cliente...</div>;
    if (!client) return <div className="text-center text-zinc-400"><h2 className="text-2xl font-bold mb-4">Cliente no encontrado</h2><Button onClick={() => router.back()} variant="ghost"><ArrowLeft className="mr-2 h-4 w-4" />Volver al Directorio</Button></div>;
    
    return (
        <main className="text-zinc-100 flex flex-col gap-6">
            {!isPresentationMode && (
                <div className="flex justify-between items-center">
                    <Button onClick={() => router.back()} variant="ghost" className="hover:bg-white/10 hover:text-white"><ArrowLeft className="mr-2 h-5 w-5" />Volver al Directorio</Button>
                </div>
            )}

            <div className={cn("bg-black rounded-[2rem] border border-white/5 p-8 shadow-2xl flex flex-col md:flex-row gap-8")}>
                 <div className="flex items-center gap-6">
                    <Image src={client.logoUrl || `https://i.pravatar.cc/80?u=${client.companyName.replace(/\s/g, '')}`} alt={`${client.companyName} logo`} width={80} height={80} className="rounded-full object-cover border-2 border-white/10"/>
                    <div>
                        <h1 className="text-4xl font-semibold tracking-tight">{client.companyName}</h1>
                         <span className={cn("mt-2 inline-block px-3 py-1 text-xs font-bold rounded-full", client.status === "Activo" ? "bg-lime-400 text-black" : "bg-cyan-500/20 text-cyan-400")}>{client.status}</span>
                    </div>
                </div>
                {!isPresentationMode && (
                    <div className="md:border-l border-t md:border-t-0 border-white/10 md:pl-8 pt-8 md:pt-0 space-y-4 flex-1">
                        <h3 className="text-lg font-medium text-zinc-400">Información de Contacto</h3>
                        <div className="flex items-center gap-4 text-zinc-300"><User className="h-5 w-5 text-zinc-500" /><span>{client.contactName}</span></div>
                        <div className="flex items-center gap-4 text-zinc-300"><Mail className="h-5 w-5 text-zinc-500" /><a href={`mailto:${client.contactEmail}`} className="hover:text-cyan-400 transition-colors">{client.contactEmail}</a></div>
                    </div>
                )}
            </div>
            
            <div className="flex justify-between items-center mt-4">
                <h2 className="text-2xl font-semibold">Proyectos</h2>
                <Button onClick={() => handleOpenAddProjectModal()} className="bg-white/5 hover:bg-white/10 text-white border border-white/10"><Plus className="mr-2 h-5 w-5"/>Añadir Proyecto</Button>
            </div>

            <div className="bg-black rounded-[2rem] border border-white/5 p-4 shadow-2xl">
                {loadingProjects ? (
                     <div className="flex items-center justify-center h-full text-zinc-500 min-h-96">
                        <LoaderCircle className="h-8 w-8 animate-spin mr-4" />
                        Cargando tablero de proyectos...
                    </div>
                ) : (
                    <ProjectKanbanBoard 
                        projects={projects} 
                        clientId={id} 
                        onAddProject={handleOpenAddProjectModal} 
                        onProjectClick={setSelectedProjectId}
                    />
                )}
            </div>

            {!isPresentationMode && <ClientDocumentVault clientId={id} clientName={client.companyName} documents={client.documents || []} />}

            {/* ── Portal Management ── */}
            {!isPresentationMode && (
                <div className="bg-black rounded-[2rem] border border-white/5 p-8 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-cyan-400" />
                        <h2 className="text-xl font-semibold">Portal del Cliente</h2>
                    </div>

                    {client.slug ? (
                        <div className="space-y-4">
                            {/* Portal link */}
                            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                                <code className="flex-1 text-sm text-cyan-400 font-mono truncate">
                                    {`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${client.slug}`}
                                </code>
                                <Button
                                    size="sm" variant="ghost"
                                    onClick={handleCopyLink}
                                    className="text-zinc-400 hover:text-white flex-shrink-0"
                                >
                                    {copied ? <CheckCheck className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}
                                </Button>
                                <a
                                    href={`/${client.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-zinc-400 hover:text-cyan-400 flex-shrink-0 p-1"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={handleSendCode}
                                    disabled={sendingCode}
                                    size="sm"
                                    className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 font-semibold"
                                >
                                    {sendingCode
                                        ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                                        : <><Send className="mr-2 h-4 w-4" />Enviar Código</>
                                    }
                                </Button>
                                <Button
                                    onClick={handleGenerateSlug}
                                    disabled={generatingSlug}
                                    size="sm"
                                    variant="ghost"
                                    className="text-zinc-400 hover:text-white border border-white/10"
                                >
                                    {generatingSlug
                                        ? <LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        : <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                    }
                                    Regenerar slug
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-start gap-3">
                            <p className="text-sm text-zinc-500">
                                Este cliente aún no tiene un portal activo.
                                Genera un slug para crear su enlace de acceso único.
                            </p>
                            <Button
                                onClick={handleGenerateSlug}
                                disabled={generatingSlug}
                                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
                            >
                                {generatingSlug
                                    ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Generando...</>
                                    : <><Sparkles className="mr-2 h-4 w-4" />Activar Portal</>
                                }
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Client Updates ── */}
            {!isPresentationMode && (
                <div className="bg-black rounded-[2rem] border border-white/5 p-8 shadow-2xl space-y-6">
                    <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-lime-400" />
                        <h2 className="text-xl font-semibold">Actualizaciones para el Cliente</h2>
                    </div>

                    {/* Add update form */}
                    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                        <Textarea
                            placeholder="Escribe una actualización visible para el cliente…"
                            value={updateText}
                            onChange={e => setUpdateText(e.target.value)}
                            className="bg-black/50 border-white/10 focus:border-cyan-500 min-h-[80px] resize-none"
                        />
                        <div className="flex gap-2">
                            <Input
                                placeholder="URL de imagen (opcional)"
                                value={updateImageUrl}
                                onChange={e => setUpdateImageUrl(e.target.value)}
                                className="bg-black/50 border-white/10 focus:border-cyan-500 flex-1 text-sm"
                            />
                            <Button
                                onClick={handleAddUpdate}
                                disabled={!updateText.trim() || savingUpdate}
                                className="bg-lime-400 text-black font-bold hover:bg-lime-300 flex-shrink-0"
                            >
                                {savingUpdate
                                    ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                    : <><Send className="mr-2 h-4 w-4" />Publicar</>
                                }
                            </Button>
                        </div>
                    </div>

                    {/* Updates list */}
                    {updates.length === 0 ? (
                        <p className="text-sm text-zinc-600 text-center py-4">
                            No hay actualizaciones publicadas aún.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {updates.map(update => (
                                <div key={update.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                                    {update.imageUrl && (
                                        <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500">
                                            <ImageIcon className="h-3.5 w-3.5" />
                                            <a href={update.imageUrl} target="_blank" rel="noreferrer" className="text-cyan-500 hover:underline truncate max-w-xs">
                                                {update.imageUrl}
                                            </a>
                                        </div>
                                    )}
                                    <p className="text-sm text-zinc-200 leading-relaxed">{update.text}</p>
                                    <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                                        <span>{update.createdBy}</span>
                                        <span>·</span>
                                        <span>{update.createdAt?.toDate
                                            ? format(update.createdAt.toDate(), "d 'de' MMM, yyyy · HH:mm", { locale: es })
                                            : 'Recién publicado'
                                        }</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <AddProjectModal isOpen={isAddProjectModalOpen} onClose={() => setIsAddProjectModalOpen(false)} clientId={id} clientName={client.companyName} defaultStatus={defaultProjectStatus}/>

            {selectedProjectId && (
                <ProjectDetailDrawer
                    isOpen={!!selectedProjectId}
                    onClose={handleCloseDrawer}
                    clientId={id}
                    projectId={selectedProjectId}
                />
            )}
        </main>
    );
}


// --- Sub-Components ---

const projectTypes = [{ value: "Web", label: "Web" }, { value: "Automatización", label: "Automatización" }, { value: "Marketing", label: "Marketing" }, { value: "App", label: "App" }];
const projectStatuses = [{ value: "Planeación", label: "Planeación" }, { value: "En desarrollo", label: "En desarrollo" }, { value: "En revisión", label: "En revisión" }, { value: "Entregado", label: "Entregado" }, { value: "Cancelado", label: "Cancelado" }];
const projectPriorities = [{ value: "Baja", label: "Baja" }, { value: "Media", label: "Media" }, { value: "Alta", label: "Alta" }, { value: "Urgente", label: "Urgente" }];

function AddProjectModal({ isOpen, onClose, clientId, clientName, defaultStatus }: { isOpen: boolean; onClose: () => void; clientId: string; clientName: string; defaultStatus?: string; }) {
    const firestore = useFirestore();
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [priority, setPriority] = useState('');
    const [startDate, setStartDate] = useState<Date>();
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<Date>();
    const [assignedTo, setAssignedTo] = useState('');
    const [comments, setComments] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && defaultStatus) {
            setStatus(defaultStatus);
        }
        if (!isOpen) {
            // Reset form
            setName('');
            setType('');
            setStatus('');
            setPriority('');
            setStartDate(undefined);
            setEstimatedDeliveryDate(undefined);
            setAssignedTo('');
            setComments('');
        }
    }, [isOpen, defaultStatus]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !name || !type || !status || !priority || !startDate) return;
        setIsSubmitting(true);
        try {
            const projectsCollection = collection(firestore, 'clients', clientId, 'projects');
            await addDoc(projectsCollection, {
                name, type, status, priority, startDate, estimatedDeliveryDate, assignedTo, comments,
                createdAt: serverTimestamp(),
            });

            await createActivityLog(firestore, {
                type: 'project',
                message: `Nuevo proyecto "${name}" creado para ${clientName}.`,
                link: `/dashboard/clients/${clientId}`
            });

            onClose();
        } catch (error) {
            console.error("Error adding project:", error);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0a0a0a] border-white/10 text-white max-w-3xl">
                <DialogHeader><DialogTitle className="text-2xl font-bold">Nuevo Proyecto</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-3">
                    <div className="space-y-2"><Label htmlFor="name">Nombre del Proyecto</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-black/50" required/></div>
                    <div className="space-y-2"><Label htmlFor="assignedTo">Responsable</Label><Input id="assignedTo" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="bg-black/50" /></div>
                    <div className="space-y-2"><Label>Tipo</Label><Combobox data={projectTypes} value={type} setValue={setType} placeholder="Seleccionar tipo..."/></div>
                    <div className="space-y-2"><Label>Estado</Label><Combobox data={projectStatuses} value={status} setValue={setStatus} placeholder="Seleccionar estado..."/></div>
                    <div className="space-y-2"><Label>Prioridad</Label><Combobox data={projectPriorities} value={priority} setValue={setPriority} placeholder="Seleccionar prioridad..."/></div>
                    <div className="space-y-2"><Label>Fecha de Inicio</Label><DatePicker date={startDate} setDate={setStartDate} /></div>
                    <div className="space-y-2"><Label>Fecha de Entrega Estimada</Label><DatePicker date={estimatedDeliveryDate} setDate={setEstimatedDeliveryDate} /></div>
                    <div className="md:col-span-2 space-y-2"><Label htmlFor="comments">Comentarios/Documentos</Label><Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} className="bg-black/50 min-h-[100px]"/></div>
                </form>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="animate-spin" /> : "Guardar Proyecto"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
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
        <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between bg-black/50 border-white/10 hover:bg-black/70 hover:text-white">{value ? data.find((item) => item.value === value)?.label : placeholder}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
        </PopoverTrigger><PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command><CommandInput placeholder={placeholder} /><CommandEmpty>No se encontró.</CommandEmpty><CommandGroup><CommandList>
                {data.map((item) => (<CommandItem key={item.value} value={item.value} onSelect={(currentValue) => { setValue(currentValue === value ? "" : currentValue); setOpen(false); }}>
                    <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />{item.label}
                </CommandItem>))}
            </CommandList></CommandGroup></Command>
        </PopoverContent></Popover>
    );
}
