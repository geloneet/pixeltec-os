'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useUser } from '@/hooks/use-user';
import {
  listClientsForPortalAdminAction,
  setPortalAccessEnabledAction,
  publishPortalUpdateAction,
} from '@/lib/client-portal/admin-actions';
import type { PortalAdminClientRow } from '@/lib/client-portal/pg';

export function PortalAdminList() {
  const user = useUser();
  const [clients, setClients] = useState<PortalAdminClientRow[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [updateImageUrl, setUpdateImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const rows = await listClientsForPortalAdminAction();
    setClients(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (clientId: string, enabled: boolean) => {
    setTogglingId(clientId);
    const result = await setPortalAccessEnabledAction(clientId, enabled);
    if (result.success) {
      setClients((prev) => prev?.map((c) => (c.id === clientId ? { ...c, portalAccessEnabled: enabled } : c)) ?? null);
    }
    setTogglingId(null);
  };

  const handlePublish = async (clientId: string) => {
    if (!updateText.trim() || !user) return;
    setPublishing(true);
    const result = await publishPortalUpdateAction(clientId, {
      text: updateText.trim(),
      imageUrl: updateImageUrl.trim() || undefined,
    });
    setPublishing(false);
    if (result.success) {
      setUpdateText('');
      setUpdateImageUrl('');
      setExpandedId(null);
      setPublishedId(clientId);
      setTimeout(() => setPublishedId(null), 3000);
    }
  };

  if (!clients) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <div key={client.id} className="rounded-lg border border-zinc-700/30 bg-zinc-800/20">
          <div className="flex items-center gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{client.name}</p>
              <p className="text-xs text-zinc-500 truncate">{client.email ?? 'Sin correo'}</p>
            </div>

            {publishedId === client.id && (
              <span className="flex items-center gap-1 text-xs text-green-400">
                <Check className="h-3.5 w-3.5" />
                Publicado
              </span>
            )}

            <button
              type="button"
              onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
              disabled={!client.portalAccessEnabled}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Megaphone className="h-3.5 w-3.5" />
              Publicar actualización
            </button>

            <div className="flex items-center gap-2">
              {togglingId === client.id && <Spinner size="sm" />}
              <Switch
                checked={client.portalAccessEnabled}
                disabled={togglingId === client.id}
                onCheckedChange={(checked) => handleToggle(client.id, checked)}
                aria-label={`Portal ${client.portalAccessEnabled ? 'activo' : 'inactivo'} para ${client.name}`}
              />
            </div>
          </div>

          {expandedId === client.id && (
            <div className="border-t border-zinc-700/30 p-4 space-y-2">
              <Textarea
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="Novedad para el cliente…"
                rows={3}
                className="bg-zinc-900/60 border-zinc-700/50 text-sm text-zinc-100"
              />
              <Input
                type="url"
                value={updateImageUrl}
                onChange={(e) => setUpdateImageUrl(e.target.value)}
                placeholder="URL de imagen (opcional)"
                className="bg-zinc-900/60 border-zinc-700/50 text-sm text-zinc-100"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setExpandedId(null); setUpdateText(''); setUpdateImageUrl(''); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handlePublish(client.id)}
                  disabled={publishing || !updateText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/20 disabled:opacity-50"
                >
                  {publishing ? <Spinner size="sm" /> : <Check className="h-3.5 w-3.5" />}
                  Publicar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
