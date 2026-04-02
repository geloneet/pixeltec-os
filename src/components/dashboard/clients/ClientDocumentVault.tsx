'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { Folder, File, Plus, Trash2, ExternalLink, Lock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import AddDocumentModal from './AddDocumentModal';

const CATEGORIES = ['Contratos', 'Facturas', 'Propuestas', 'Credenciales', 'Manual del proyecto'] as const;
type Category = typeof CATEGORIES[number];

interface Document {
  name: string;
  url: string;
  category: Category;
  uploadDate: any;
}

interface ClientDocumentVaultProps {
  clientId: string;
  clientName: string;
  documents: Document[];
}

export default function ClientDocumentVault({ clientId, clientName, documents }: ClientDocumentVaultProps) {
  const [openCategory, setOpenCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const documentsByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = documents.filter(doc => doc.category === category);
    return acc;
  }, {} as Record<Category, Document[]>);

  const toggleCategory = (category: Category) => {
    setOpenCategory(prev => (prev === category ? null : category));
  };

  const handleDeleteDocument = async (docToDelete: Document) => {
    if (!firestore) return;
    if (!window.confirm(`¿Estás seguro de eliminar "${docToDelete.name}"?`)) return;

    const clientRef = doc(firestore, 'clients', clientId);
    try {
      await updateDoc(clientRef, {
        documents: arrayRemove(docToDelete)
      });
      toast({ description: 'Documento eliminado.' });
    } catch (error) {
      console.error("Error deleting document: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el documento.' });
    }
  };

  return (
    <>
      <div className="bg-black rounded-[2rem] border border-white/5 p-8 shadow-2xl mt-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Bóveda de Documentos</h2>
            <Button onClick={() => setIsModalOpen(true)} className="bg-white/5 hover:bg-white/10 text-white border border-white/10"><Plus className="mr-2 h-5 w-5"/>Añadir Documento</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATEGORIES.map(category => (
            <Collapsible key={category} open={openCategory === category} onOpenChange={() => toggleCategory(category)}>
              <CollapsibleTrigger asChild>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    {category === 'Credenciales' && documentsByCategory[category].length > 0 ? <Lock className="h-5 w-5 text-yellow-400" /> : <Folder className="h-5 w-5 text-cyan-400" />}
                    <span className="font-medium text-white">{category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                      <span className="text-sm font-mono bg-black/50 text-zinc-400 rounded-md px-2 py-0.5">{documentsByCategory[category].length}</span>
                      <ChevronDown className={cn("h-5 w-5 text-zinc-500 transition-transform", openCategory === category && "rotate-180")} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-black/40 rounded-b-xl p-4 mt-1 border border-t-0 border-white/10 space-y-2">
                    {documentsByCategory[category].length === 0 ? (
                        <p className="text-center text-xs text-zinc-500 py-2">No hay documentos aquí.</p>
                    ) : (
                        documentsByCategory[category].map((doc, index) => (
                            <div key={index} className="group flex items-center justify-between gap-2 p-2 bg-white/5 rounded-md text-sm">
                                <div className="flex items-center gap-2 truncate">
                                    <File className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                                    <span className="text-zinc-300 truncate">{doc.name}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-cyan-400"><ExternalLink className="h-4 w-4" /></Button>
                                    </a>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-500" onClick={() => handleDeleteDocument(doc)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
      <AddDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        clientId={clientId}
        clientName={clientName}
      />
    </>
  );
}
