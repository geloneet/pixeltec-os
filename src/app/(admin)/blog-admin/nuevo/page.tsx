import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/auth/session";
import { NuevoBriefForm } from "./nuevo-brief-form";

export default async function NuevoBriefPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/login?redirect=/blog-admin/nuevo");

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nuevo Brief</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define el tema y ángulo del artículo. Claude generará el borrador completo.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <NuevoBriefForm />
      </section>
    </div>
  );
}
