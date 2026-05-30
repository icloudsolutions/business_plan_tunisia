"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = ({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) => (
  <ToastPrimitive.Viewport
    className={cn(
      "fixed bottom-4 end-4 z-50 flex max-h-[100vh] w-full max-w-sm flex-col-reverse gap-2 p-0 outline-none sm:flex-col",
      className
    )}
    {...props}
  />
);

export const Toast = ({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root>) => (
  <ToastPrimitive.Root
    className={cn(
      "pointer-events-auto relative w-full overflow-hidden rounded-lg border border-navy-100 bg-white p-4 shadow-lg ring-1 ring-navy-900/5",
      className
    )}
    {...props}
  />
);

export const ToastClose = ({
  className,
  "aria-label": ariaLabel = "Fermer la notification",
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Close>) => (
  <ToastPrimitive.Close
    className={cn(
      "absolute end-2 top-2 rounded-md p-1 text-navy-600 hover:bg-navy-50 hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
      className
    )}
    toast-close=""
    aria-label={ariaLabel}
    {...props}
  >
    <X className="h-4 w-4" aria-hidden />
  </ToastPrimitive.Close>
);

export const ToastTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) => (
  <ToastPrimitive.Title
    className={cn("pe-6 text-sm font-semibold text-navy-900", className)}
    {...props}
  />
);

export const ToastDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) => (
  <ToastPrimitive.Description
    className={cn("mt-1 text-sm text-navy-600", className)}
    {...props}
  />
);
