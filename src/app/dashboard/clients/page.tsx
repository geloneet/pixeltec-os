'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    Filter,
    X,
    LoaderCircle,
    Pencil,
    Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ShinyButton } from '@/components/ui/shiny-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SiNextdotjs, SiTailwindcss, SiFirebase, SiPython } from '@icons-pack/react-simple-icons';
import { useFirestore } from '@/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAdmin } from '@/hooks/use-admin';
import { usePresentationMode } from '@/context/PresentationModeContext';
import ConfirmDialog from '@/components/dashboard/ConfirmDialog';
import { sendNewClientEmailAction } from '@/app/actions';
import { generateSlug } from '@/lib/portal';


const techIcons: { [key: string]: React.ReactNode } = {
    "Next.js": <SiNextdotjs className="h-5 w-5" title="Next.js" />,
    "Firebase": <SiFirebase className="h-5 w-5 text-yellow-500" title="Firebase" />,
    "Tailwind CSS": <SiTailwindcss className="h-5 w-5 text-cyan-400" title="Tailwind CSS" />,
    "Python": <SiPython className="h-5 w-5 text-blue-400" title="Python" />,
};

interface Client {
    id: string;
    companyName: string;
    logoUrl?: string;
    contactName: string;
    contactEmail: string;
    whatsapp?: string;
    website?: string;
    techStack: string[];
    services?: string[];
    status: 'Lead' | 'Activo' | 'Inactivo';
    clientValue?: number;
    assignedTo?: 'Miguel' | 'Asistente';
    location?: string;
    initialNotes?: string;
}

const serviceOptions = ["Página web", "Marketing digital", "Automatización", "Soporte técnico"];

interface ClientFormState {
    companyName: string;
    contactName: string;
    contactEmail: string;
    whatsapp: string;
    website: string;
    techStack: string;
    services: string[];
    status: 'Lead' | 'Activo' | 'Inactivo';
    clientValue: string;
    assignedTo: 'Miguel' | 'Asistente';
    location: string;
    initialNotes: string;
}

const initialFormState: ClientFormState = {
    companyName: '',
    contactName: '',
    contactEmail: '',
    whatsapp: '',
    website: '',
    techStack: '',
    services: [],
    status: 'Lead',
    clientValue: '',
    assignedTo: 'Miguel',
    location: '',
    initialNotes: '',
};

export default function ClientsPage() {
    const firestore = useFirestore();
    const { isAdmin } = useAdmin();
    const { isPresentationMode } = usePresentationMode();
    
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<ClientFormState>(initialFormState);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);

    const filteredClients = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return clients;
        return clients.filter(client =>
            client.companyName.toLowerCase().includes(q) ||
            client.contactName.toLowerCase().includes(q) ||
            client.contactEmail.toLowerCase().includes(q) ||
            (client.location ?? '').toLowerCase().includes(q)
        );
    }, [clients, searchQuery]);

    useEffect(() => {
        if (!firestore) return;

        setLoading(true);
        const clientsQuery = query(collection(firestore, 'clients'), orderBy('companyName', 'asc'));
        
        const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Client));
            setClients(clientsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching clients: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firestore]);

    const handleModalOpen = (client: Client | null = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                companyName: client.companyName,
                contactName: client.contactName,
                contactEmail: client.contactEmail,
                whatsapp: client.whatsapp || '',
                website: client.website || '',
                techStack: client.techStack?.join(', ') || '',
                services: client.services || [],
                status: client.status,
                clientValue: client.clientValue?.toString() || '',
                assignedTo: client.assignedTo || 'Miguel',
                location: client.location || '',
                initialNotes: client.initialNotes || '',
            });
        } else {
            setEditingClient(null);
            setFormData(initialFormState);
        }
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingClient(null);
        setFormData(initialFormState);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleServiceChange = (service: string) => {
        setFormData(prev => {
            const newServices = prev.services.includes(service)
                ? prev.services.filter(s => s !== service)
                : [...prev.services, service];
            return { ...prev, services: newServices };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore) return;
        setIsSubmitting(true);
        
        const dataToSave = {
            ...formData,
            techStack: formData.techStack.split(',').map(s => s.trim()).filter(Boolean),
            clientValue: formData.clientValue ? parseFloat(formData.clientValue) : null,
        };

        try {
            if (editingClient) {
                const clientRef = doc(firestore, 'clients', editingClient.id);
                await updateDoc(clientRef, dataToSave);
            } else {
                await addDoc(collection(firestore, 'clients'), {
                    ...dataToSave,
                    logoUrl: `https://i.pravatar.cc/40?u=${formData.companyName.replace(/\s/g, '')}`,
                    slug: generateSlug(formData.companyName),
                });
                // Fire welcome email — non-blocking, doesn't affect UX if it fails
                if (formData.contactEmail) {
                    sendNewClientEmailAction({
                        email:       formData.contactEmail,
                        clientName:  formData.contactName,
                        companyName: formData.companyName,
                        services:    formData.services,
                        assignedTo:  formData.assignedTo,
                    }).catch(console.error);
                }
            }
            handleModalClose();
        } catch (error) {
            console.error("Error saving document: ", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteRequest = (client: Client) => {
        setClientToDelete(client);
        setConfirmOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!firestore || !clientToDelete) return;
        await deleteDoc(doc(firestore, 'clients', clientToDelete.id));
        setClientToDelete(null);
    };


    return (
        <div className="text-zinc-100 flex flex-col gap-6">
            {/* Header */}
            {!isPresentationMode && (
                <header className="flex justify-between items-center">
                    <h1 className="text-4xl font-semibold tracking-tight">Directorio de Clientes</h1>
                    <ShinyButton onClick={() => handleModalOpen()}>
                        <Plus className="h-5 w-5" />
                        Añadir Cliente
                    </ShinyButton>
                </header>
            )}

            {/* Toolbar */}
             {!isPresentationMode && (
                <div className="bg-white/5 border border-white/10 rounded-full px-4 py-2 flex justify-between items-center backdrop-blur-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                        <Input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por empresa, contacto, email o ciudad..."
                            className="bg-transparent border-none pl-10 focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
                        />
                    </div>
                    <Button variant="ghost" className="hover:bg-white/10 hover:text-white">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtrar
                    </Button>
                </div>
             )}

            {/* Clients Table */}
            <div className="bg-black rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead className="border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4 font-medium text-zinc-500">Empresa</th>
                            <th className="px-6 py-4 font-medium text-zinc-500">Contacto</th>
                            <th className="px-6 py-4 font-medium text-zinc-500">Tech Stack</th>
                            <th className="px-6 py-4 font-medium text-zinc-500">Estado</th>
                             {!isPresentationMode && <th className="px-6 py-4 font-medium text-zinc-500 text-right">Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="text-center p-8 text-zinc-500">Cargando clientes...</td></tr>
                        ) : filteredClients.length === 0 ? (
                           <tr>
                               <td colSpan={5} className="text-center p-8 text-zinc-500">
                                   {searchQuery
                                       ? `No se encontraron resultados para "${searchQuery}".`
                                       : 'No se encontraron clientes. ¡Añade el primero!'}
                               </td>
                           </tr>
                        ) : filteredClients.map((client) => (
                            <tr key={client.id} className="border-b border-white/5 last:border-b-0">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <Image
                                            src={client.logoUrl || `https://i.pravatar.cc/40?u=${client.companyName.replace(/\s/g, '')}`}
                                            alt={`${client.companyName} logo`}
                                            width={40}
                                            height={40}
                                            className="rounded-full object-cover"
                                        />
                                        <Link href={`/dashboard/clients/${client.id}`} className="font-semibold hover:text-cyan-400 transition-colors">
                                          {client.companyName}
                                        </Link>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div>
                                        <p className="font-medium">{client.contactName}</p>
                                        <p className="text-zinc-400">{client.contactEmail}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3 text-zinc-400">
                                        {client.techStack.map(tech => (
                                            <div key={tech} className="transition-transform hover:scale-125">
                                                {techIcons[tech] || null}
                                            </div>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "px-3 py-1 text-xs font-bold rounded-full",
                                        client.status === "Activo" ? "bg-lime-400 text-black"
                                        : client.status === "Lead" ? "bg-cyan-500/20 text-cyan-400"
                                        : "bg-zinc-700 text-zinc-300"
                                    )}>
                                        {client.status}
                                    </span>
                                </td>
                                {!isPresentationMode && (
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="text-zinc-500 hover:bg-white/10 hover:text-cyan-400" onClick={() => handleModalOpen(client)}>
                                                <Pencil className="h-5 w-5" />
                                            </Button>
                                            {isAdmin && (
                                                <Button variant="ghost" size="icon" className="text-zinc-500 hover:bg-white/10 hover:text-red-500" onClick={() => handleDeleteRequest(client)} aria-label={`Eliminar ${client.companyName}`}>
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Eliminar cliente"
                description={`¿Eliminar a "${clientToDelete?.companyName}"? Se eliminará su registro. Esta acción no se puede deshacer.`}
                confirmLabel="Sí, eliminar"
                onConfirm={handleConfirmDelete}
            />

            {/* Add/Edit Client Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative">
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-zinc-500 hover:text-white" onClick={handleModalClose}>
                            <X className="h-5 w-5" />
                        </Button>
                        <h2 className="text-2xl font-bold mb-6">{editingClient ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</h2>
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-2">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Nombre de la Empresa</Label>
                                    <Input id="companyName" name="companyName" placeholder="PixelTEC" value={formData.companyName} onChange={handleFormChange} required className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactName">Nombre del Contacto</Label>
                                    <Input id="contactName" name="contactName" placeholder="Miguel Robles" value={formData.contactName} onChange={handleFormChange} required className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactEmail">Email del Contacto</Label>
                                    <Input id="contactEmail" name="contactEmail" type="email" placeholder="hola@pixeltec.mx" value={formData.contactEmail} onChange={handleFormChange} required className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="whatsapp">WhatsApp</Label>
                                    <Input id="whatsapp" name="whatsapp" placeholder="+52 322 123 4567" value={formData.whatsapp} onChange={handleFormChange} className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="website">Sitio Web</Label>
                                    <Input id="website" name="website" placeholder="https://pixeltec.mx" value={formData.website} onChange={handleFormChange} className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="location">Ciudad / Ubicación</Label>
                                    <Input id="location" name="location" placeholder="Puerto Vallarta" value={formData.location} onChange={handleFormChange} className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="clientValue">Valor del Cliente</Label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500 text-sm">MX$</span>
                                        <Input id="clientValue" name="clientValue" type="number" placeholder="50000" value={formData.clientValue} onChange={handleFormChange} className="bg-white/5 border-white/10 focus:border-cyan-500 pl-12" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="assignedTo">Responsable</Label>
                                    <select id="assignedTo" name="assignedTo" value={formData.assignedTo} onChange={handleFormChange} className="bg-white/5 border border-white/10 rounded-md p-2 h-10 w-full focus:border-cyan-500 focus:ring-cyan-500">
                                        <option value="Miguel">Miguel</option>
                                        <option value="Asistente">Asistente</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="status">Tipo de Cliente</Label>
                                    <select id="status" name="status" value={formData.status} onChange={handleFormChange} className="bg-white/5 border border-white/10 rounded-md p-2 h-10 w-full focus:border-cyan-500 focus:ring-cyan-500">
                                        <option value="Lead">Prospecto</option>
                                        <option value="Activo">Cliente Activo</option>
                                        <option value="Inactivo">Cliente Inactivo</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label>Servicios Contratados</Label>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 p-3 rounded-md bg-white/5 border border-white/10">
                                        {serviceOptions.map(service => (
                                            <div key={service} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={service}
                                                    checked={formData.services.includes(service)}
                                                    onCheckedChange={() => handleServiceChange(service)}
                                                    className="border-zinc-500"
                                                />
                                                <Label htmlFor={service} className="text-sm font-normal text-zinc-300">{service}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="techStack">Tech Stack (separado por comas)</Label>
                                    <Input id="techStack" name="techStack" placeholder="Next.js, Firebase" value={formData.techStack} onChange={handleFormChange} className="bg-white/5 border-white/10 focus:border-cyan-500" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="initialNotes">Notas</Label>
                                    <Textarea id="initialNotes" name="initialNotes" placeholder="Descripción inicial del cliente o proyecto..." value={formData.initialNotes} onChange={handleFormChange} className="bg-white/5 border-white/10 focus:border-cyan-500 min-h-[100px]" />
                                </div>
                           </div>
                            <div className="flex justify-end gap-4 mt-4">
                                <Button type="button" variant="ghost" onClick={handleModalClose} className="text-zinc-400 hover:text-white">Cancelar</Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-lime-400 text-black font-bold hover:bg-lime-300">
                                    {isSubmitting ? <LoaderCircle className="animate-spin" /> : editingClient ? 'Guardar Cambios' : 'Guardar Cliente'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
