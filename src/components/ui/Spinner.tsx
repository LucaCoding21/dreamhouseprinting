import { cn } from "@/lib/cn";

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  /** Diameter in pixels. */
  size?: number;
}

/** Indeterminate loading spinner. Inherits color via `currentColor`. */
export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn("animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}
