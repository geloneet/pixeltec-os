"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertTriangle, Check, Info, X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-3 p-6 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[400px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  cn(
    // base layout
    "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-4 pr-10",
    // glassmorphism (superficie del token, no gris fijo)
    "bg-popover/95 backdrop-blur-[20px] backdrop-saturate-150",
    "shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25),inset_0_0_0_1px_rgba(255,255,255,0.04)]",
    // typography defaults
    "text-popover-foreground",
    // swipe transforms (kept from Radix)
    "transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[swipe=end]:animate-out",
    // open: fade + slide-in (mobile bottom, desktop right)
    "data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:ease-out",
    "data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-full",
    "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:slide-in-from-right-full",
    // closed: fade + slide-out to the right
    "data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=closed]:ease-out",
    "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full"
  ),
  {
    variants: {
      variant: {
        default: "border-border",
        success: "border-cyan-500/30",
        destructive: "destructive group border-rose-500/30",
        warning: "border-amber-500/30",
        info: "border-sky-500/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type ToastVariant = NonNullable<VariantProps<typeof toastVariants>["variant"]>

/**
 * Icon node injected automatically based on `variant`. Mapping is static so
 * Tailwind can pick up the per-variant color classes at build time
 * (`bg-cyan-500/10`, `text-rose-400`, …); never templated with dynamic
 * string concat or those classes would be purged.
 */
const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
      <Check className="h-5 w-5 text-cyan-400" aria-hidden="true" />
    </span>
  ),
  destructive: (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
      <X className="h-5 w-5 text-rose-400" aria-hidden="true" />
    </span>
  ),
  warning: (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
      <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
    </span>
  ),
  info: (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10">
      <Info className="h-5 w-5 text-sky-400" aria-hidden="true" />
    </span>
  ),
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, children, ...props }, ref) => {
  const icon = VARIANT_ICONS[variant ?? "default"]
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "mt-2 inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent px-3 text-xs font-medium text-foreground transition-colors",
      "hover:bg-secondary/60",
      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-popover",
      "disabled:pointer-events-none disabled:opacity-50",
      "group-[.destructive]:border-rose-500/30 group-[.destructive]:text-rose-200 group-[.destructive]:hover:bg-rose-500/10 group-[.destructive]:hover:border-rose-500/50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors",
      "hover:text-foreground",
      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-popover",
      className
    )}
    toast-close=""
    aria-label="Cerrar notificación"
    {...props}
  >
    <X className="h-4 w-4" aria-hidden="true" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold tracking-tight text-popover-foreground", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("mt-0.5 text-xs leading-relaxed text-muted-foreground", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
