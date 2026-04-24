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
  { label: "About", href: "/about" },
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
            src="/testimonailsplusfooter/dogasset.png"
            alt=""
            width={364}
            height={628}
            className="block h-auto w-[110px] translate-y-[47px] sm:w-[125px] sm:translate-y-[55px] lg:w-[140px] lg:translate-y-[63px]"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-6 py-14 lg:px-10 lg:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/homepage_assets/Dreamhouse logo.png"
                alt="Dreamhouse Printing"
                width={140}
                height={140}
                className="h-14 w-14 lg:h-16 lg:w-16"
              />
              <span className="font-display text-[22px] font-extrabold leading-[1.05] text-dream-scribble lg:text-[26px]">
                Dreamhouse
                <br />
                Printing
              </span>
            </Link>
            <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-dream-ink-soft">
              Custom screen printing &amp; embroidery for Vancouver businesses,
              teams, and brands.
            </p>
            <div className="mt-6 flex flex-wrap gap-5 text-sm font-medium text-dream-ink">
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

          <div>
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
