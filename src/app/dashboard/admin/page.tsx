'use client';

import { useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Users,
  DollarSign,
  ListTodo,
  LifeBuoy,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUserProfile } from '@/firebase/auth/use-user-profile';
import { cn } from '@/lib/utils';
import {
  sendTestEmailAction,
  sendNewClientEmailAction,
  sendPaymentEmailAction,
  sendTaskEmailAction,
  sendTicketEmailAction,
} from '@/app/actions';

// ─── Test cases ────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'sending' | 'ok' | 'error';

interface EmailTest {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  run: (to: string) => Promise<{ success: boolean; error?: string }>;
}

const EMAIL_TESTS: EmailTest[] = [
  {
    id: 'test',
    label: 'Email de Prueba',
    description: 'Verifica que la integración con Resend esté funcionando.',
    icon: Mail,
    color: 'text-cyan-400',
    run: (to) => sendTestEmailAction({ to }),
  },
  {
    id: 'welcome',
    label: 'Bienvenida (Cliente)',
    description: 'Email que se envía cuando se registra un nuevo cliente.',
    icon: Users,
    color: 'text-violet-400',
    run: (to) =>
      sendNewClientEmailAction({
        email:       to,
        clientName:  'Carlos García',
        companyName: 'Demo Company S.A.',
        services:    ['Página web', 'Marketing digital'],
        assignedTo:  'Miguel Robles',
      }),
  },
  {
    id: 'invoice',
    label: 'Pago Recibido',
    description: 'Notificación interna cuando una transacción se marca como Pagado.',
    icon: DollarSign,
    color: 'text-lime-400',
    run: (to) =>
      sendPaymentEmailAction({
        clientName:  'Demo Company S.A.',
        projectName: 'Sitio web corporativo',
        amount:      25000,
        method:      'Transferencia',
        type:        'Único',
        date:        new Date().toLocaleDateString('es-MX', { dateStyle: 'long' }),
      }).then((r) => r),
  },
  {
    id: 'task',
    label: 'Nueva Tarea',
    description: 'Notificación interna cuando se crea una tarea global.',
    icon: ListTodo,
    color: 'text-yellow-400',
    run: (to) =>
      sendTaskEmailAction({
        taskTitle:   'Configurar dominio y SSL para demo.pixeltec.mx',
        responsible: 'Miguel Robles',
        status:      'Pendiente',
        dueDate:     'Próximo viernes',
      }).then((r) => r),
  },
  {
    id: 'ticket',
    label: 'Ticket de Soporte',
    description: 'Notificación interna cuando se abre un nuevo ticket.',
    icon: LifeBuoy,
    color: 'text-orange-400',
    run: (to) =>
      sendTicketEmailAction({
        ticketId:  'TKT-042',
        cliente:   'Demo Company S.A.',
        problema:  'El sitio web no carga correctamente en dispositivos móviles. El menú de navegación se superpone con el contenido principal.',
        categoria: 'Página web',
        prioridad: 'Alta',
        createdAt: new Date().toLocaleString('es-MX'),
      }).then((r) => r),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { userProfile, loading } = useUserProfile();
  const { toast } = useToast();
  const [targetEmail, setTargetEmail] = useState('');
  const [statuses, setStatuses] = useState<Record<string, TestStatus>>({});

  const setStatus = (id: string, s: TestStatus) =>
    setStatuses(prev => ({ ...prev, [id]: s }));

  const handleSend = async (test: EmailTest) => {
    if (!targetEmail.includes('@')) {
      toast({ variant: 'destructive', title: 'Email inválido', description: 'Ingresa un correo destino válido.' });
      return;
    }

    setStatus(test.id, 'sending');
    try {
      const result = await test.run(targetEmail);
      if (result.success) {
        setStatus(test.id, 'ok');
        toast({ title: `✅ Enviado: ${test.label}`, description: `Revisa ${targetEmail}` });
      } else {
        setStatus(test.id, 'error');
        toast({ variant: 'destructive', title: `Error: ${test.label}`, description: result.error });
      }
    } catch (err) {
      setStatus(test.id, 'error');
      toast({ variant: 'destructive', title: 'Error inesperado', description: String(err) });
    }
  };

  const handleSendAll = async () => {
    for (const test of EMAIL_TESTS) {
      await handleSend(test);
      // small delay between sends
      await new Promise(r => setTimeout(r, 600));
    }
  };

  // ── Guard ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (userProfile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <AlertTriangle className="h-12 w-12 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Acceso Restringido</h1>
        <p className="text-zinc-400 max-w-sm">Solo administradores pueden acceder al panel de administración.</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
          <ShieldCheck className="h-6 w-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
          <p className="text-zinc-400 text-sm">Herramientas del sistema — solo para administradores</p>
        </div>
      </div>

      {/* Email Test Section */}
      <div className="bg-black rounded-[2rem] border border-white/5 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-cyan-400" />
          <h2 className="font-semibold text-white">Prueba de Emails Transaccionales</h2>
        </div>

        <p className="text-sm text-zinc-400">
          Envía emails de prueba para verificar que la integración con Resend está funcionando
          correctamente. Requiere <code className="bg-white/10 px-1 rounded text-xs">RESEND_API_KEY</code> configurada en el servidor.
        </p>

        {/* Email input */}
        <div className="space-y-2">
          <Label className="text-zinc-300">Correo destino</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 flex-1"
            />
            <Button
              onClick={handleSendAll}
              disabled={!targetEmail.includes('@') || Object.values(statuses).some(s => s === 'sending')}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold whitespace-nowrap"
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar Todos
            </Button>
          </div>
        </div>

        {/* Test cards */}
        <div className="space-y-2">
          {EMAIL_TESTS.map(test => {
            const status = statuses[test.id] ?? 'idle';
            const Icon = test.icon;
            return (
              <div
                key={test.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border transition-colors',
                  status === 'ok'    ? 'bg-lime-500/5 border-lime-500/20' :
                  status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                                       'bg-white/5 border-white/5 hover:border-white/10'
                )}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', test.color)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{test.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{test.description}</p>
                </div>

                {/* Status icon */}
                {status === 'ok'      && <CheckCircle2 className="h-5 w-5 text-lime-400 flex-shrink-0" />}
                {status === 'error'   && <XCircle      className="h-5 w-5 text-red-400 flex-shrink-0" />}
                {status === 'sending' && <Loader2      className="h-5 w-5 text-cyan-400 animate-spin flex-shrink-0" />}

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={status === 'sending' || !targetEmail.includes('@')}
                  onClick={() => handleSend(test)}
                  className="text-cyan-400 hover:bg-cyan-900/30 hover:text-cyan-300 flex-shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
