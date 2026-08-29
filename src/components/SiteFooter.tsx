import Image from "next/image";
import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Shirts", href: "/shop?category=shirts" },
  { label: "Hoodies", href: "/shop?category=hoodies" },
  { label: "Hats", href: "/shop?category=hats-toques" },
  { label: "Bags", href: "/shop?category=totes" },
  { label: "All products", href: "/shop" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "How to order", href: "/how-to-order" },
  { label: "Services", href: "/services" },
  { label: "FAQ", href: "/services#faq" },
  { label: "Contact", href: "/contact" },
];


export default function SiteFooter({ hideDog = false }: { hideDog?: boolean }) {
  return (
    <footer className="relative mt-16 bg-dream-lavender-soft lg:mt-24">
      {/* The dog peeks off the right edge on mobile (translate-x-20), which used
          to widen the DOCUMENT by ~80px and side-scroll every page on a phone.
          overflow-x-clip crops that overhang without creating a scroll container
          (overflow-x-hidden would, and would break the sticky headers
          elsewhere); overflow-y stays visible so the dog still pokes up over the
          footer's top edge. */}
      {!hideDog && (
        <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 overflow-x-clip">
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
      )}

      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10 lg:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center">
              <Image
                src="/dreamhouse-logo4.svg"
                alt="Dreamhouse Printing"
                width={1668}
                height={547}
                className="h-14 w-auto lg:h-[84px]"
              />
            </Link>
            <p className="mt-3 max-w-[320px] text-[14px] leading-relaxed text-dream-ink-soft">
              Custom screen printing &amp; embroidery for Vancouver businesses,
              teams, and brands.
            </p>
          </div>

          <FooterColumn title="Products" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />

          <div className="col-span-2 lg:col-span-1">
            <h3 className="font-display text-[14px] font-bold uppercase tracking-wider text-dream-ink">
              Get started
            </h3>
            <div className="mt-4">
              <Link
                href="/#quick-quote"
                className="inline-flex items-center justify-center rounded-full bg-dream-purple px-5 py-2.5 font-display text-sm font-bold text-white transition hover:-translate-y-0.5"
              >
                Get a quote
              </Link>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-dream-ink-soft">
              <li>
                <a
                  href="mailto:admin@dreamhouseprinting.com"
                  className="hover:text-dream-ink"
                >
                  admin@dreamhouseprinting.com
                </a>
              </li>
              <li>323 Alexander St, Vancouver, BC V6A 1C4</li>
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
      <h3 className="font-display text-[14px] font-bold uppercase tracking-wider text-dream-ink">
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
