"use client";

import { useUser } from "@/firebase";
import { CRMProvider } from "@/components/crm/CRMContext";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export default function CRMLayout({ children }: { children: ReactNode }) {
  const user = useUser();

  if (user === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0c0c0e]">
        <LoaderCircle className="h-10 w-10 animate-spin text-[#6d5acd]" />
      </div>
    );
  }

  if (!user) return null;

  return <CRMProvider>{children}</CRMProvider>;
}
