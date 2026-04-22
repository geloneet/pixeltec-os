import { LoaderCircle } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoaderCircle className="h-8 w-8 animate-spin text-cyan-400" />
    </div>
  );
}
