"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { ssCatalogAction, importStylesAction, type CatalogStyle } from "./actions";

/**
 * Must match IMPORT_BATCH_SIZE in ./actions. A "use server" module can only
 * export async functions, so the number lives in both places.
 */
const CHUNK = 10;

/**
 * Bulk import from S&S as a checklist. Julian's ask was "a checklist that shows
 * them all", so the whole CA catalog (~1,060 styles) loads in one server call
 * and every filter is client-side, which keeps ticking boxes instant.
 */
export function ImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  /** Called when a single style was imported, so we can land on its editor. */
  onImported: (productId: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [styles, setStyles] = useState<CatalogStyle[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requested = useRef(false);
  // Derived rather than stored, so the fetch effect below never has to set
  // state synchronously (which cascades a render, and the lint rule blocks it).
  const loading = styles === null && loadError === null;

  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [hideImported, setHideImported] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const running = progress !== null;

  const apply = useCallback((res: { styles?: CatalogStyle[]; error?: string }) => {
    if (res.error || !res.styles) {
      setLoadError(res.error ?? "Couldn't load the catalog.");
      return;
    }
    setLoadError(null);
    setStyles(res.styles);
  }, []);

  // Fetch once, on first open. The server caches the payload for an hour, so
  // reopening the dialog later is instant. State lands in the promise callback,
  // never synchronously in the effect body.
  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    let alive = true;
    void ssCatalogAction().then((res) => {
      if (alive) apply(res);
    });
    return () => {
      alive = false;
    };
  }, [open, apply]);

  function retryLoad() {
    setLoadError(null);
    void ssCatalogAction().then(apply);
  }

  // Closing keeps the loaded catalog but drops the picks.
  function close() {
    setSelected(new Set());
    setProgress(null);
    onClose();
  }

  const brands = useMemo(
    () => [...new Set((styles ?? []).map((s) => s.brand))].sort((a, b) => a.localeCompare(b)),
    [styles],
  );
  const categories = useMemo(
    () =>
      [...new Set((styles ?? []).map((s) => s.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [styles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (styles ?? []).filter((s) => {
      if (brand && s.brand !== brand) return false;
      if (category && s.category !== category) return false;
      if (hideImported && s.productId) return false;
      if (!q) return true;
      return (
        s.brand.toLowerCase().includes(q) ||
        s.styleName.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q)
      );
    });
  }, [styles, query, brand, category, hideImported]);

  // Only un-imported rows can be ticked, so "select all shown" ignores the rest.
  const selectableShown = useMemo(() => filtered.filter((s) => !s.productId), [filtered]);
  const allShownSelected =
    selectableShown.length > 0 && selectableShown.every((s) => selected.has(s.styleID));

  function toggle(styleID: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(styleID)) next.delete(styleID);
      else next.add(styleID);
      return next;
    });
  }

  function toggleAllShown() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) selectableShown.forEach((s) => next.delete(s.styleID));
      else selectableShown.forEach((s) => next.add(s.styleID));
      return next;
    });
  }

  async function runImport() {
    const ids = (styles ?? []).filter((s) => !s.productId && selected.has(s.styleID)).map((s) => s.styleID);
    if (!ids.length) return;

    const imported: { styleID: number; productId: string }[] = [];
    const failures: { styleID: number; error: string }[] = [];
    setProgress({ done: 0, total: ids.length });

    // Chunked and sequential: the server refuses more than CHUNK per call, and
    // each style costs 2 S&S requests.
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const res = await importStylesAction(chunk);
      if (res.error) {
        chunk.forEach((styleID) => failures.push({ styleID, error: res.error as string }));
      } else {
        for (const r of res.results) {
          if (r.productId) imported.push({ styleID: r.styleID, productId: r.productId });
          else failures.push({ styleID: r.styleID, error: r.error ?? "Import failed" });
        }
      }
      setProgress({ done: imported.length + failures.length, total: ids.length });
    }

    // Flag what landed so the list reads true without a second catalog fetch.
    const byStyle = new Map(imported.map((r) => [r.styleID, r.productId]));
    setStyles((prev) =>
      prev
        ? prev.map((s) => (byStyle.has(s.styleID) ? { ...s, productId: byStyle.get(s.styleID)! } : s))
        : prev,
    );
    setSelected(new Set());
    setProgress(null);

    // One style behaves like the old single import: straight to its editor.
    if (imported.length === 1 && failures.length === 0) {
      onImported(imported[0].productId);
      return;
    }

    if (imported.length) {
      toast({
        title: `${imported.length} imported as hidden drafts`,
        description: failures.length
          ? `${failures.length} couldn't be imported. First error: ${failures[0].error}`
          : "Set the category, pricing, and print area on each, then switch them on.",
        variant: failures.length ? "default" : "success",
      });
    } else {
      toast({
        title: "Nothing imported",
        description: failures[0]?.error ?? "Unknown error",
        variant: "error",
      });
    }
    router.refresh();
    close();
  }

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !running && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import from S&amp;S Activewear</DialogTitle>
          <DialogDescription>
            Tick every blank you want in the shop, then import them in one go.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <p className="text-xs text-dream-muted">
            Products import as hidden drafts. You&apos;ll set the category, pricing, and print area next, then
            turn them on.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Input
              autoFocus
              placeholder="Search brand, style # or name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={running}
            />
            <Select value={brand} onChange={(e) => setBrand(e.target.value)} disabled={running}>
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={running}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Checkbox
              id="ss-hide-imported"
              label="Hide already imported"
              checked={hideImported}
              disabled={running}
              onChange={(e) => setHideImported(e.target.checked)}
            />
            <div className="flex items-center gap-3">
              <span className="text-xs text-dream-muted">
                {filtered.length} shown · {selectedCount} selected
              </span>
              <button
                type="button"
                onClick={toggleAllShown}
                disabled={running || selectableShown.length === 0}
                className="text-xs font-medium text-dream-purple hover:underline disabled:opacity-50 disabled:hover:no-underline"
              >
                {allShownSelected ? "Clear" : "Select all shown"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 max-h-[55vh] overflow-y-auto border-t border-dream-line">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6 text-dream-purple" />
            </div>
          ) : loadError ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-dream-muted">{loadError}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={retryLoad}>
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-dream-muted">
              Nothing matched. Try a style number (like 3001) or a brand. This is the S&amp;S Canada catalog,
              US-only styles won&apos;t appear.
            </p>
          ) : (
            <div className="divide-y divide-dream-line">
              {filtered.map((s) => (
                <StyleRow
                  key={s.styleID}
                  style={s}
                  checked={selected.has(s.styleID)}
                  disabled={running}
                  onToggle={() => toggle(s.styleID)}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap justify-between gap-2">
          <span className="text-xs text-dream-muted">
            {progress ? `Importing ${progress.done} of ${progress.total}…` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={close} disabled={running}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={running}
              disabled={selectedCount === 0}
              onClick={() => void runImport()}
            >
              {running ? "Importing" : selectedCount ? `Import ${selectedCount} selected` : "Import selected"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One catalog row. Kept to plain elements, ~1,000 of these render at once. */
function StyleRow({
  style,
  checked,
  disabled,
  onToggle,
}: {
  style: CatalogStyle;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const imported = Boolean(style.productId);
  const body = (
    <>
      {/* The row is the <label>, so the box goes in unlabelled. Checkbox only
          draws its tick in the labelled variant, so pair it with the same
          peer-checked mark here. */}
      <span className="relative inline-flex shrink-0">
        <Checkbox checked={imported || checked} disabled={imported || disabled} onChange={onToggle} />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className="pointer-events-none absolute left-0 top-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100"
        >
          <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
        {style.image && (
          // eslint-disable-next-line @next/next/no-img-element -- 1,000 remote S&S thumbs, next/image would mint 1,000 optimizer requests
          <img
            src={style.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-dream-muted">{style.brand}</div>
        <div className="text-sm text-dream-ink">
          <span className="font-medium">{style.styleName}</span>
          {style.title ? ` · ${style.title}` : ""}
        </div>
      </div>
      <div className="hidden shrink-0 max-w-[10rem] truncate text-xs text-dream-muted sm:block">
        {style.category}
      </div>
      {imported && (
        <Link
          href={`/admin/products/${style.productId}`}
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant="success">Imported</Badge>
        </Link>
      )}
    </>
  );

  // Imported rows carry a link, so they can't be a <label> (clicking the link
  // would toggle a checkbox instead of navigating).
  if (imported) {
    return <div className="flex items-center gap-3 px-5 py-2 opacity-70">{body}</div>;
  }
  return (
    <label
      className={`flex items-center gap-3 px-5 py-2 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-dream-bg"
      }`}
    >
      {body}
    </label>
  );
}
