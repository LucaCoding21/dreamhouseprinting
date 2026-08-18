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

export type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Override classes for the backdrop. Every dialog dims with the same grey
   *  scrim by default (per Julian, 2026-07-19); only pass this for a
   *  deliberate exception. */
  backdropClassName?: string;
  /** Every dialog renders the top-right X by default; set true only when the
   *  panel provides its own close affordance in the same spot. */
  hideClose?: boolean;
};

export function DialogContent({
  className,
  children,
  backdropClassName = "bg-dream-overlay/50 backdrop-blur-sm",
  hideClose = false,
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

  // Move focus into the panel on open, unless a child already claimed it
  // (an autoFocus input like the Change-product search must keep focus so
  // typing works immediately).
  useEffect(() => {
    const panel = panelRef.current;
    if (open && panel && !panel.contains(document.activeElement)) panel.focus();
  }, [open]);

  // Portal target only exists on the client; nothing renders during SSR
  // since a closed dialog renders null anyway.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop sits behind the panel and covers the whole overlay, so a
          click anywhere outside the panel lands here and closes the dialog. */}
      <div
        aria-hidden="true"
        onMouseDown={() => onOpenChange(false)}
        className={cn("absolute inset-0", backdropClassName)}
      />
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
        {!hideClose && <DialogClose />}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DialogClose({ className }: { className?: string }) {
  const { onOpenChange } = useDialog("DialogClose");
  return (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      aria-label="Close"
      className={cn(
        "absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg text-dream-muted transition-colors hover:bg-dream-bg hover:text-dream-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple",
        className,
      )}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-1 p-5 pb-3 pr-12", className)}
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
