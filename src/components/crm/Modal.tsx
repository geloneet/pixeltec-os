"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md bg-[#151518] border border-[#2a2a2f] rounded-[10px] p-6 shadow-2xl">
        <h2 className="text-[20px] font-semibold text-zinc-200">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
