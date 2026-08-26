import { redirect } from "next/navigation";

/**
 * `/seo` no es una pantalla: es la puerta del módulo. Entra por Salud, que es
 * el resumen desde el que se llega a todo lo demás.
 */
export default function SeoIndexPage() {
  redirect("/seo/salud");
}
