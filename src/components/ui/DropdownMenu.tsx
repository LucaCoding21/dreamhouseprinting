"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown(component: string) {
  const ctx = useContext(DropdownContext);
  if (!ctx)
    throw new Error(`<${component}> must be used within <DropdownMenu>`);
  return ctx;
}

export type DropdownMenuProps = React.HTMLAttributes<HTMLDivElement>;

export function DropdownMenu({
  className,
  children,
  ...props
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Click-outside + Escape close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        !triggerRef.current?.contains(t) &&
        !contentRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <DropdownContext.Provider
      value={{ open, setOpen, triggerRef, contentRef }}
    >
      <div className={cn("relative inline-block", className)} {...props}>
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export type DropdownMenuTriggerProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuTriggerProps
>(({ className, onClick, ...props }, forwardedRef) => {
  const { open, setOpen, triggerRef } = useDropdown("DropdownMenuTrigger");
  return (
    <button
      ref={(node) => {
        triggerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40 rounded-lg",
        className,
      )}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export interface DropdownMenuContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Horizontal alignment relative to the trigger. */
  align?: "start" | "end";
}

export function DropdownMenuContent({
  className,
  align = "start",
  children,
  ...props
}: DropdownMenuContentProps) {
  const { open, contentRef } = useDropdown("DropdownMenuContent");
  if (!open) return null;
  return (
    <div
      ref={contentRef}
      role="menu"
      className={cn(
        "absolute z-50 mt-1 min-w-[10rem] rounded-lg border border-dream-line bg-dream-surface p-1 shadow-lg",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Keep the menu open after selecting (default closes). */
  closeOnSelect?: boolean;
}

export function DropdownMenuItem({
  className,
  onClick,
  closeOnSelect = true,
  disabled,
  ...props
}: DropdownMenuItemProps) {
  const { setOpen } = useDropdown("DropdownMenuItem");
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (closeOnSelect) setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-dream-ink",
        "transition-colors hover:bg-dream-bg focus-visible:bg-dream-bg focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
