import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getAdminOrder } from "@/lib/admin/orders";
import {
  asSceneMap,
  asSourceFiles,
  collectPieces,
  isImageFilename,
  viewLabel,
} from "../artworkPieces";
import type { LineItemDecorations } from "../../actions";
import { ArtworkSheet, type ArtworkSection, type ArtworkTile } from "./ArtworkSheet";

export const metadata = { title: "Artwork | Admin" };

/**
 * Every piece of art on one order, stacked on a single printable page, so the
 * artwork can be pulled into Illustrator in one pass instead of line by line.
 * Same permission gate as the order detail page.
 */
export default async function OrderArtworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [, detail] = await Promise.all([requirePermission("orders.view"), getAdminOrder(id)]);
  if (!detail) notFound();

  const designById = new Map(detail.designs.map((d) => [d.id, d]));

  // Proofs from the proofs table (where every upload lands now), oldest first
  // so "Proof 1" is the first one made. PDFs can't render as <img>, so they
  // list as files.
  const PROOF_STATUS: Record<string, string> = {
    pending: "not approved yet",
    approved: "approved",
    changes_requested: "changes requested",
  };
  const proofTile = (p: (typeof detail.proofs)[number], n: number): ArtworkTile => ({
    key: `proof-${p.id}`,
    kind: /\.pdf(\?|#|$)/i.test(p.image) ? "file" : "image",
    label: `Proof ${n}, ${PROOF_STATUS[p.status] ?? p.status}`,
    src: p.image,
    href: p.image,
    name: `Proof ${n}.pdf`,
  });
  const proofs = [...detail.proofs].filter((p) => p.image).reverse();
  const lineIds = new Set(detail.lineItems.map((li) => li.id));

  // Same manual queue order the items section uses, so the sheet reads in the
  // order Julian arranged the job.
  const lines = detail.lineItems
    .map((li, i) => {
      const dec = (li.decorations ?? {}) as Partial<LineItemDecorations>;
      return { li, pos: typeof dec.position === "number" ? dec.position : i };
    })
    .sort((a, b) => a.pos - b.pos)
    .map((x) => x.li);

  const sections: ArtworkSection[] = lines.map((li, idx) => {
    const colour = (li.colour ?? {}) as { name?: string; hex?: string | null };
    const design = li.design_id ? designById.get(li.design_id) : undefined;
    const sizes = (li.size_quantities ?? {}) as Record<string, number>;
    const pieces = design ? collectPieces(asSceneMap(design.scene_definition)) : [];
    const sourceFiles = design ? asSourceFiles(design.source_artwork_files) : [];
    const mockups = ((design?.mockup_images ?? []) as { view?: string; url?: string | null }[]).filter((m) => m.url);

    const tiles: ArtworkTile[] = [];

    for (const file of sourceFiles) {
      tiles.push({
        key: `src-${li.id}-${file.path || file.name}`,
        kind: file.url && isImageFilename(file.name) ? "image" : "file",
        label: `Customer upload, ${file.name}`,
        src: file.url ?? null,
        href: file.url ?? null,
        name: file.name,
      });
    }

    for (const piece of pieces) {
      tiles.push({
        key: `piece-${li.id}-${piece.key}`,
        kind: piece.kind === "text" ? "text" : "image",
        label: `${viewLabel(piece.view)}, ${
          piece.kind === "image" ? `image ${piece.index}` : piece.kind === "sticker" ? `clip art ${piece.index}` : `text ${piece.index}`
        }`,
        src: piece.src ?? null,
        href: piece.src ?? null,
        text: piece.text ?? null,
        fill: piece.fill ?? null,
      });
    }

    for (const m of mockups) {
      tiles.push({
        key: `mockup-${li.id}-${m.view ?? "view"}`,
        kind: "image",
        label: `Mockup, ${viewLabel(m.view ?? "view")}`,
        src: m.url ?? null,
        href: m.url ?? null,
      });
    }

    proofs
      .filter((p) => p.line_item_id === li.id)
      .forEach((p, n) => tiles.push(proofTile(p, n + 1)));

    return {
      id: li.id,
      title: `${idx + 1}. ${li.product_name ?? "Item"}`,
      subtitle: [
        colour.name ?? null,
        design?.name ? `“${design.name}”` : null,
        Object.entries(sizes)
          .filter(([, q]) => Number(q) > 0)
          .map(([s, q]) => `${s}×${q}`)
          .join("  ") || null,
      ]
        .filter(Boolean)
        .join(", "),
      colourHex: colour.hex ?? null,
      tiles,
    };
  });

  // Order-level proofs (not pinned to a line, or pinned to a line since
  // deleted) plus legacy official mockups, filed at the end of the sheet.
  const orderProofs = proofs.filter((p) => !p.line_item_id || !lineIds.has(p.line_item_id));
  const officials = ((detail.order.official_mockups ?? []) as { url?: string; path?: string }[]).filter((m) => m.url);
  if (orderProofs.length > 0 || officials.length > 0) {
    sections.push({
      id: "official-mockups",
      title: "Proofs on file",
      subtitle: "Mockups sent to the customer for approval",
      colourHex: null,
      tiles: [
        ...orderProofs.map((p, i) => proofTile(p, i + 1)),
        ...officials.map(
          (m, i): ArtworkTile => ({
            key: `official-${i}`,
            // PDF proofs can't render as <img>, list them as downloadable files.
            kind: /\.pdf(\?|#|$)/i.test(m.path ?? m.url ?? "") ? "file" : "image",
            label: `Proof ${orderProofs.length + i + 1}`,
            src: m.url ?? null,
            href: m.url ?? null,
          }),
        ),
      ],
    });
  }

  return (
    <ArtworkSheet
      orderId={detail.order.id}
      orderNumber={detail.order.order_number}
      customerName={detail.customer?.name ?? detail.customer?.email ?? detail.order.guest_email ?? null}
      sections={sections}
    />
  );
}
