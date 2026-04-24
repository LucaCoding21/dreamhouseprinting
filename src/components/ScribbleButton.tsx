import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const SCRIBBLE_SRC = "/homepage_assets/handdrawnbuttoncircleexmaple.svg";

type BaseProps = {
  children: ReactNode;
  rotate?: number;
  className?: string;
};

type LinkButtonProps = BaseProps & {
  href: string;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;

type ClickButtonProps = BaseProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

type ScribbleButtonProps = LinkButtonProps | ClickButtonProps;

function Inner({ children, rotate }: { children: ReactNode; rotate: number }) {
  return (
    <span className="relative inline-flex items-center justify-center px-8 py-3.5 font-display text-[17px] font-medium text-dream-ink">
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
  const { children, rotate = 0, className = "" } = props;
  const wrapperClass = `group inline-block ${className}`.trim();

  if (props.href !== undefined) {
    const { href, rotate: _r, className: _c, children: _ch, ...rest } = props;
    void _r;
    void _c;
    void _ch;
    return (
      <Link href={href} className={wrapperClass} {...rest}>
        <Inner rotate={rotate}>{children}</Inner>
      </Link>
    );
  }

  const { rotate: _r, className: _c, children: _ch, href: _h, ...rest } = props;
  void _r;
  void _c;
  void _ch;
  void _h;
  return (
    <button type="button" className={wrapperClass} {...rest}>
      <Inner rotate={rotate}>{children}</Inner>
    </button>
  );
}
