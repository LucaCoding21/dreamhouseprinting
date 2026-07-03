import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { swatchStyle } from "@/lib/swatch";
import { formatCAD } from "@/lib/money";
import { cn } from "@/lib/cn";

interface DesignColour {
  name?: string;
  hex?: string | null;
}

export default async function MyDesignsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: designs } = await supabase
    .from("designs")
    .select(
      "id, product_id, status, mockup_images, colour, size_quantities, price_snapshot, created_at, products(name, brand)",
    )
    .order("created_at", { ascending: false });

  const list = designs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-dream-ink">My designs</h1>
          <p className="mt-1 text-dream-muted">
            {list.length > 0
              ? "Pick up where you left off, or start something new."
              : "Everything you create in the designer is saved here."}
          </p>
        </div>
        <Link href="/shop">
          <Button variant="primary">Start a new design</Button>
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-dream-line bg-dream-lavender-soft/40 px-6 py-16 text-center">
          <Image
            src="/how it works/3dog.png"
            alt=""
            width={120}
            height={120}
            className="h-28 w-auto"
          />
          <div>
            <h3 className="font-display text-lg font-bold text-dream-ink">No saved designs yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-dream-muted">
              Head to the shop, drop your art on a shirt, and save it. Your work in
              progress will wait for you right here.
            </p>
          </div>
          <Link href="/shop">
            <Button variant="primary">Browse products</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((d) => {
            const mock = ((d.mockup_images ?? []) as { url: string | null }[]).find((m) => m.url)?.url;
            const product = (d.products ?? null) as { name?: string; brand?: string } | null;
            const colour = (d.colour ?? {}) as DesignColour;
            const sizes = (d.size_quantities ?? {}) as Record<string, number>;
            const qty = Object.values(sizes).reduce((sum, q) => sum + (Number(q) || 0), 0);
            const total = ((d.price_snapshot ?? {}) as { total?: number }).total;
            const isDraft = d.status === "draft";

            return (
              <Link
                key={d.id}
                href={`/design/${d.product_id}?design=${d.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col overflow-hidden rounded-2xl border border-dream-line bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-dream-purple hover:shadow-[0_8px_0_0_rgba(27,20,88,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-purple/40"
              >
                {/* Mockup */}
                <div className="relative aspect-square w-full overflow-hidden border-b border-dream-line bg-white">
                  <span
                    className={cn(
                      "absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm",
                      isDraft
                        ? "bg-dream-muted text-white"
                        : "bg-dream-success text-white",
                    )}
                  >
                    {isDraft ? "Draft" : "Submitted"}
                  </span>
                  {mock ? (
                    <Image
                      src={mock}
                      alt={product?.name ?? "Saved design"}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ShirtIcon className="h-12 w-12 text-dream-lavender-deep/50" />
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  {product?.brand && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-dream-purple">
                      {product.brand}
                    </span>
                  )}
                  <h3 className="line-clamp-1 font-display text-base font-semibold leading-snug text-dream-ink">
                    {product?.name ?? "Custom design"}
                  </h3>

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-dream-muted">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {colour.name && (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-dream-line"
                            style={swatchStyle({ name: colour.name, hex: colour.hex ?? null })}
                          />
                          {colour.name}
                        </span>
                      )}
                      {qty > 0 && <span>{qty} pc{qty === 1 ? "" : "s"}</span>}
                    </span>
                    {total != null && (
                      <span className="font-semibold text-dream-ink">
                        Est. {formatCAD(total)}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-dream-line pt-3">
                    <span className="text-xs text-dream-faint">
                      {new Date(d.created_at).toLocaleDateString("en-CA")}
                    </span>
                    <span className="text-sm font-semibold text-dream-purple">
                      Open
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShirtIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </svg>
  );
}
