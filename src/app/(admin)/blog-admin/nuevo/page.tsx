import { redirect } from "next/navigation";
import { requireUserSession } from "@/lib/auth/session";
import { NuevoBriefForm } from "./nuevo-brief-form";

export default async function NuevoBriefPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  const session = await requireUserSession();
  if (!session) redirect("/login?redirect=/blog-admin/nuevo");

  const { modo } = await searchParams;
  const ideaMode = modo === "idea";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {ideaMode ? "Nueva idea" : "Nuevo artículo con IA"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ideaMode
            ? "Guarda el tema y ángulo para retomarlo después — sin generar nada todavía."
            : "Define el tema y ángulo del artículo. Claude generará el borrador completo."}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <NuevoBriefForm ideaMode={ideaMode} />
      </section>
    </div>
  );
}
