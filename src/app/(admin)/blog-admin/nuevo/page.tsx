import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/crypto-intel/auth";
import { NuevoBriefForm } from "./nuevo-brief-form";

export default async function NuevoBriefPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/blog-admin/nuevo");

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Nuevo Brief</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Define el tema y ángulo del artículo. Claude generará el borrador completo.
        </p>
      </div>

      <section className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
        <NuevoBriefForm />
      </section>
    </div>
  );
}
