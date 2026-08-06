import { cn } from "@/lib/utils";
import { postStatusClass, postStatusLabel } from "./blog-admin-logic";

/** Chip de estado compartido del Blog Admin (lista y editor). */
export function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  );
}

/** Chip para estados de post: label y clase salen de blog-admin-logic —
 *  una sola fuente para lista y editor. */
export function PostStatusChip({ status }: { status: string }) {
  return <StatusChip label={postStatusLabel(status)} className={postStatusClass(status)} />;
}
