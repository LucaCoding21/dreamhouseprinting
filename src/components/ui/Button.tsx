import React from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "subtle";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-dream-purple text-white hover:bg-dream-purple-dark shadow-sm",
  secondary:
    "bg-white border border-dream-line text-dream-ink hover:bg-dream-bg",
  ghost: "bg-transparent text-dream-ink hover:bg-dream-bg",
  danger: "bg-dream-danger text-white hover:bg-dream-danger/90 shadow-sm",
  subtle: "bg-dream-lavender-soft text-dream-ink hover:bg-dream-lavender-soft/70",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
  icon: "h-10 w-10 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center font-display font-medium",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40",
          "disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <Spinner size={size === "sm" ? 14 : size === "lg" ? 18 : 16} />
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
