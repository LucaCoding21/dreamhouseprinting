import { NextResponse } from "next/server";
import { getActiveProducts } from "@/lib/db/catalog";
import { productPrimaryImage } from "@/lib/productImage";
import { shopPriceAtQty } from "@/lib/pricing/quote";

/**
 * Type-ahead for the nav search: the handful of products a query matches, with
 * just enough to draw a suggestion row (name, thumbnail, price).
 *
 * It reuses getActiveProducts' own search, so the suggestions and the /shop
 * page they lead to can never disagree about what matches. Prices are quoted at
 * the same default quantity the shop cards use, for the same reason.
 */
export const runtime = "nodejs";

const LIMIT = 5;
/** Matches ShopQuantity's default, so a suggestion's price equals its card's. */
const QUOTE_QTY = 25;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const products = await getActiveProducts({ search: q, limit: LIMIT });

  return NextResponse.json({
    results: products.map((p) => {
      const price = shopPriceAtQty(p, QUOTE_QTY);
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        image: productPrimaryImage(p),
        price: price.amount,
      };
    }),
  });
}
