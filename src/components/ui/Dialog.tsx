"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog(component: string) {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error(`<${component}> must be used within <Dialog>`);
  return ctx;
}

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = React.useId();
  const descId = React.useId();
  return (
    <DialogContext.Provider value={{ open, onOpenChange, titleId, descId }}>
      {children}
    </DialogContext.Provider>
  );
}

export type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

export function DialogContent({
  className,
  children,
  ...props
}: DialogContentProps) {
  const { open, onOpenChange, titleId, descId } = useDialog("DialogContent");
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  // Move focus into the panel on open.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Portal target only exists on the client; nothing renders during SSR
  // since a closed dialog renders null anyway.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        // Backdrop click (not a click that bubbled from the panel) closes.
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div aria-hidden="true" className="absolute inset-0" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-dream-line bg-dream-surface shadow-xl",
          "focus-visible:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-1 p-5 pb-3", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialog("DialogTitle");
  return (
    <h2
      id={titleId}
      className={cn(
        "font-display text-lg font-semibold text-dream-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const { descId } = useDialog("DialogDescription");
  return (
    <p
      id={descId}
      className={cn("text-sm text-dream-muted", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-dream-line p-5 pt-3",
        className,
      )}
      {...props}
    />
  );
}
