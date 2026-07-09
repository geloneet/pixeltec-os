"use client";

import { useParams, useRouter } from "next/navigation";
import { useCRM } from "@/components/crm/CRMContextCore";
import { useCRMShell } from "@/components/crm/CRMShellProvider";
import { ToolDetailView } from "@/components/crm/ToolDetailView";
import { Spinner } from "@/components/ui/spinner";

export default function AccesoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const crm = useCRM();
  const shell = useCRMShell();

  if (crm.loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner size="lg" className="text-cyan-400" />
      </div>
    );
  }

  const tool = crm.tools.find((t) => t.id === params.id);

  if (!tool) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 text-sm mb-4">Recurso no encontrado</p>
        <button
          onClick={() => router.push("/accesos")}
          className="rounded-lg bg-[#0EA5E9] px-4 py-2 text-sm text-white hover:bg-[#0284C7] transition-all duration-150"
        >
          ← Ver accesos
        </button>
      </div>
    );
  }

  return (
    <ToolDetailView
      tool={tool}
      onBack={() => router.push("/accesos")}
      onEditTool={() =>
        shell.setModal({
          type: "editTool",
          data: { id: tool.id, name: tool.name, icon: tool.icon, color: tool.color },
        })
      }
      onDeleteTool={() => {
        crm.deleteTool(tool.id);
        router.push("/accesos");
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
