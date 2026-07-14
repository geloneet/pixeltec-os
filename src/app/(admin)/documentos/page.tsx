"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Receipt, FileSignature, FileCheck } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { getInvoices } from "@/lib/documents/invoices";
import { getContracts } from "@/lib/documents/contracts";
import { getProposals } from "@/lib/documents/proposals";
import type { Invoice, Contract, Proposal } from "@/types/documents";
import { BienvenidaGenerator } from "@/components/ia/BienvenidaGenerator";

type StatCard = { label: string; value: number; icon: React.ElementType; color: string };

function StatTile({ label, value, icon: Icon, color }: StatCard) {
  return (
    <div className="rounded-xl bg-card border border-border p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function DocumentosPage() {
  const user = useUser();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [inv, con, pro] = await Promise.all([
        getInvoices(user.uid),
        getContracts(user.uid),
        getProposals(user.uid),
      ]);
      setInvoices(inv);
      setContracts(con);
      setProposals(pro);
      setError(null);
    } catch (err) {
      console.error('[DocumentosPage] load failed:', err);
      setError('No se pudieron cargar los documentos. Intenta de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const invoicePagado = invoices.filter(i => i.status === "pagada").length;
  const contractFirmado = contracts.filter(c => c.status === "firmado").length;

  const recentInvoices = invoices.slice(0, 5);
  const recentContracts = contracts.slice(0, 5);

  const formatMXN = (n: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
        <p className="text-sm text-muted-foreground mt-1">Contratos, facturas y propuestas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Facturas totales"
          value={invoices.length}
          icon={Receipt}
          color="bg-blue-500/10 text-blue-700 dark:text-blue-300"
        />
        <StatTile
          label="Facturas pagadas"
          value={invoicePagado}
          icon={FileCheck}
          color="bg-green-500/10 text-green-700 dark:text-green-300"
        />
        <StatTile
          label="Contratos firmados"
          value={contractFirmado}
          icon={FileSignature}
          color="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
        />
        <StatTile
          label="Propuestas"
          value={proposals.length}
          icon={FileText}
          color="bg-muted text-muted-foreground"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Facturas recientes</h2>
          {recentInvoices.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">No hay facturas aún.</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg bg-card border border-border px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.number}</p>
                    <p className="text-xs text-muted-foreground">{inv.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{formatMXN(inv.total)}</span>
                    <a
                      href={`/api/documents/invoice-pdf?invoiceId=${inv.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                    >
                      PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent contracts */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Contratos recientes</h2>
          {recentContracts.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">No hay contratos aún.</p>
          ) : (
            <div className="space-y-2">
              {recentContracts.map(con => (
                <div
                  key={con.id}
                  className="flex items-center justify-between rounded-lg bg-card border border-border px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                      {con.title}
                    </p>
                    <p className="text-xs text-muted-foreground">v{con.version} · {con.status}</p>
                  </div>
                  <a
                    href={`/api/documents/contract-pdf?contractId=${con.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
                  >
                    PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bienvenida generator */}
      <BienvenidaGenerator />
    </div>
  );
}
