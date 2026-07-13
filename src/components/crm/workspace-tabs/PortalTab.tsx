'use client';

import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Check, X, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useUser } from '@/hooks/use-user';
import {
  getPortalStatusForClientAction,
  setPortalAccessEnabledAction,
  publishPortalUpdateAction,
} from '@/lib/client-portal/admin-actions';

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string;
}

/**
 * Portal de acceso de ESTE cliente — activar/desactivar + publicar
 * actualizaciones. Antes vivía como lista plana de todos los clientes en
 * /portal-admin; ahora es una pestaña más de la ficha del cliente.
 */
export function PortalTab({ clientId, clientName, clientEmail }: Props) {
  const user = useUser();
  const [status, setStatus] = useState<{ portalAccessEnabled: boolean; email: string | null } | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [updateImageUrl, setUpdateImageUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const load = useCallback(async () => {
    const result = await getPortalStatusForClientAction(clientId);
    setStatus(result);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    setToggleError(null);
    const result = await setPortalAccessEnabledAction(clientId, enabled);
    if (result.success) {
      setStatus((prev) => (prev ? { ...prev, portalAccessEnabled: enabled } : prev));
    } else {
      // Antes este error se descartaba en silencio (PortalAdminList) y el
      // switch simplemente no prendía sin explicar por qué.
      setToggleError(result.error ?? 'No se pudo actualizar el portal.');
    }
    setToggling(false);
  };

  const handlePublish = async () => {
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
      setExpanded(false);
      setPublished(true);
      setTimeout(() => setPublished(false), 3000);
    }
  };

  if (!status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h3 className="font-poppins text-sm font-semibold text-foreground">Portal de {clientName}</h3>
        <p className="mt-1 font-roboto text-xs text-muted-foreground">
          {status.email ?? (clientEmail || 'Sin correo — el portal no podrá enviarle un código de acceso.')}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Acceso al portal</p>
            <p className="text-xs text-muted-foreground">
              {status.portalAccessEnabled ? 'Activo — el cliente puede iniciar sesión con su correo.' : 'Inactivo'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {toggling && <Spinner size="sm" />}
            <Switch
              checked={status.portalAccessEnabled}
              disabled={toggling}
              onCheckedChange={handleToggle}
              aria-label={`Portal ${status.portalAccessEnabled ? 'activo' : 'inactivo'} para ${clientName}`}
            />
          </div>
        </div>
        {toggleError && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
            <p className="text-xs text-red-300">{toggleError}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-secondary/20">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Publicar actualización</p>
            <p className="text-xs text-muted-foreground">Novedad visible en el feed del portal del cliente.</p>
          </div>
          {published && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Check className="h-3.5 w-3.5" />
              Publicado
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={!status.portalAccessEnabled}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Megaphone className="h-3.5 w-3.5" />
            {expanded ? 'Cerrar' : 'Nueva actualización'}
          </button>
        </div>

        {expanded && (
          <div className="border-t border-border p-4 space-y-2">
            <Textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="Novedad para el cliente…"
              rows={3}
              className="bg-card/60 border-border text-sm text-foreground"
            />
            <Input
              type="url"
              value={updateImageUrl}
              onChange={(e) => setUpdateImageUrl(e.target.value)}
              placeholder="URL de imagen (opcional)"
              className="bg-card/60 border-border text-sm text-foreground"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setExpanded(false); setUpdateText(''); setUpdateImageUrl(''); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePublish}
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
    </div>
  );
}
