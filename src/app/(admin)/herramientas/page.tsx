"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ToolsView } from "@/components/crm/ToolsView";

export default function HerramientasPage() {
  const crm = useCRM();
  const shell = useCRMShell();
  const router = useRouter();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <ToolsView
      tools={crm.tools}
      onSelectTool={(id) => router.push(`/herramientas/${id}`)}
      onAddTool={() => shell.setModal({ type: "addTool" })}
    />
  );
}
