"use client";

import { useRouter } from "next/navigation";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ToolsView } from "@/components/crm/ToolsView";
import { Spinner } from "@/components/ui/spinner";

export default function AccesosPage() {
  const crm = useCRM();
  const shell = useCRMShell();
  const router = useRouter();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  return (
    <ToolsView
      tools={crm.tools}
      onSelectTool={(id) => router.push(`/accesos/${id}`)}
      onAddTool={() => shell.setModal({ type: "addTool" })}
    />
  );
}
