"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Toaster } from "sonner";
import { useUser } from "@/firebase";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function VpsLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      router.push("/login");
    }
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <LoaderCircle className="h-10 w-10 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative flex min-h-screen w-full bg-zinc-950 text-zinc-100">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(139,92,246,0.06),transparent_50%)]"
      />
      <AdminSidebar />
      <main className="relative z-10 flex-1 overflow-x-hidden">{children}</main>
      <Toaster
        richColors
        position="top-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              "border border-zinc-800/60 bg-zinc-900/90 backdrop-blur-xl text-zinc-100",
          },
        }}
      />
    </div>
  );
}
