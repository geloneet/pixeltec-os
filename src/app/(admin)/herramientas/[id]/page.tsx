"use client";

import { useParams, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContext";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ToolDetailView } from "@/components/crm/ToolDetailView";

export default function HerramientaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const crm = useCRM();
  const shell = useCRMShell();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const tool = crm.tools.find((t) => t.id === params.id);

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 text-sm mb-4">Herramienta no encontrada</p>
        <button
          onClick={() => router.push("/herramientas")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver herramientas
        </button>
      </div>
    );
  }

  return (
    <ToolDetailView
      tool={tool}
      onBack={() => router.push("/herramientas")}
      onEditTool={() =>
        shell.setModal({
          type: "editTool",
          data: { id: tool.id, name: tool.name, icon: tool.icon, color: tool.color },
        })
      }
      onDeleteTool={() => {
        crm.deleteTool(tool.id);
        router.push("/herramientas");
      }}
      onAddTip={() => shell.setModal({ type: "addTip" })}
      onEditTip={(tip) =>
        shell.setModal({
          type: "editTip",
          data: {
            id: tip.id,
            title: tip.title,
            summary: tip.summary,
            content: tip.content,
            tags: tip.tags.join(", "),
          },
        })
      }
      onDeleteTip={(tipId) => crm.deleteTip(tool.id, tipId)}
    />
  );
}
