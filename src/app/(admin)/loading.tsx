import { Spinner } from "@/components/ui/spinner";

export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner size="lg" className="text-cyan-400" />
    </div>
  );
}
