import React from "react";
import { cn } from "@/lib/cn";
import { Label } from "./Label";

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  /** Error message, shown in red below the control; also a no-op if falsy. */
  error?: React.ReactNode;
  /** Helper text shown below the control when there is no error. */
  hint?: React.ReactNode;
  required?: boolean;
  /** id of the control, wired to the label's htmlFor for accessibility. */
  htmlFor?: string;
  children: React.ReactNode;
}

/** Composes a Label, a control, and optional error/help text. */
export function Field({
  label,
  error,
  hint,
  required,
  htmlFor,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} {...props}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-dream-danger">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-[14px] text-dream-danger">{error}</p>
      ) : hint ? (
        <p className="text-[14px] text-dream-muted">{hint}</p>
      ) : null}
    </div>
  );
}
