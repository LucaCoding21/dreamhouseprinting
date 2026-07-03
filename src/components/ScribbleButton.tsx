import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const SCRIBBLE_SRC = "/homepage_assets/handdrawnbuttoncircleexmaple.svg";

type BaseProps = {
  children: ReactNode;
  rotate?: number;
  className?: string;
  size?: "sm" | "md";
};

type LinkButtonProps = BaseProps & {
  href: string;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;

type ClickButtonProps = BaseProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

type ScribbleButtonProps = LinkButtonProps | ClickButtonProps;

function Inner({
  children,
  rotate,
  size = "md",
}: {
  children: ReactNode;
  rotate: number;
  size?: "sm" | "md";
}) {
  const sizeClass =
    size === "sm" ? "px-6 py-2.5 text-[15px]" : "px-8 py-3.5 text-[17px]";
  return (
    <span
      className={`relative inline-flex items-center justify-center font-display font-medium text-dream-ink ${sizeClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SCRIBBLE_SRC}
        alt=""
        aria-hidden
        className="scribble-morph pointer-events-none absolute inset-0 h-full w-full"
        style={{ transform: `rotate(${rotate}deg)` }}
      />
      <span className="relative z-10 whitespace-nowrap">{children}</span>
    </span>
  );
}

export default function ScribbleButton(props: ScribbleButtonProps) {
  const { children, rotate = 0, className = "", size = "md" } = props;
  const wrapperClass = `group inline-block ${className}`.trim();

  if (props.href !== undefined) {
    const { href, rotate: _r, className: _c, children: _ch, size: _s, ...rest } = props;
    void _r;
    void _c;
    void _ch;
    void _s;
    return (
      <Link href={href} className={wrapperClass} {...rest}>
        <Inner rotate={rotate} size={size}>{children}</Inner>
      </Link>
    );
  }

  const { rotate: _r, className: _c, children: _ch, href: _h, size: _s, ...rest } = props;
  void _r;
  void _c;
  void _ch;
  void _h;
  void _s;
  return (
    <button type="button" className={wrapperClass} {...rest}>
      <Inner rotate={rotate} size={size}>{children}</Inner>
    </button>
  );
}
