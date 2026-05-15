import Image from "next/image";
import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Shirts", href: "/quote?product=shirt" },
  { label: "Hoodies", href: "/quote?product=hoodie" },
  { label: "Hats", href: "/quote?product=hat" },
  { label: "Totes", href: "/quote?product=bag" },
  { label: "All products", href: "/quote" },
];

const COMPANY_LINKS = [
  { label: "Services", href: "/services" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "Facebook", href: "https://facebook.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
];


export default function SiteFooter() {
  return (
    <footer className="relative bg-dream-lavender-soft">
      <div className="pointer-events-none absolute inset-x-0 bottom-full z-10">
        <div className="mx-auto flex max-w-[1400px] justify-end px-6 lg:px-10">
          <Image
            src="/testimonailsplusfooter/footerdog.png"
            alt=""
            width={364}
            height={628}
            className="block h-auto w-[285px] translate-x-20 translate-y-[39px] sm:w-[325px] sm:translate-x-0 sm:translate-y-[44px] lg:w-[370px] lg:translate-y-[51px]"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10 lg:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center">
              <Image
                src="/dreamhouse-logo-full.png"
                alt="Dreamhouse Printing"
                width={1800}
                height={600}
                className="h-14 w-auto lg:h-[100px]"
              />
            </Link>
            <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed text-dream-ink-soft">
              Custom screen printing &amp; embroidery for Vancouver businesses,
              teams, and brands.
            </p>
            <div className="mt-5 flex flex-wrap gap-5 text-sm font-medium text-dream-ink">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Products" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />

          <div className="col-span-2 lg:col-span-1">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-dream-ink">
              Get started
            </h3>
            <div className="mt-4">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center rounded-full bg-dream-purple px-5 py-2.5 font-display text-sm font-bold text-white transition hover:-translate-y-0.5"
              >
                Get a quote
              </Link>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-dream-ink-soft">
              <li>
                <a href="tel:16045551234" className="hover:text-dream-ink">
                  (604) 555-1234
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@dreamhouseprinting.ca"
                  className="hover:text-dream-ink"
                >
                  hello@dreamhouseprinting.ca
                </a>
              </li>
              <li>123 Main St, Vancouver, BC</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="font-display text-xs font-bold uppercase tracking-wider text-dream-ink">
        {title}
      </h3>
      <ul className="mt-4 space-y-2 text-sm text-dream-ink-soft">
        {links.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="hover:text-dream-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
