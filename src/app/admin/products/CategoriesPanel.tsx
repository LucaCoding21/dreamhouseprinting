"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import type { CategoryRow, ProductRow } from "@/lib/db/rows";
import {
  addCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  categoryUsageAction,
  reorderCategoriesAction,
} from "./categoryActions";

/**
 * Admin > Products > Categories. Main categories with their sub-categories
 * tucked underneath, in shop order. Reorder by dragging the handle (md+) or
 * with the up/down arrows (phones), always within one group: mains among
 * mains, subs among their siblings.
 *
 * Drags reorder a local copy optimistically; a server refresh (new
 * `categories` prop) re-seeds it.
 */
export function CategoriesPanel({
  categories,
  products,
  addOpen,
  onAddOpenChange,
  backTo,
}: {
  categories: CategoryRow[];
  products: Pick<ProductRow, "id" | "category_id" | "subcategory_id">[];
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
  /** The product editor that sent Julian here, for the "Back to" link. */
  backTo: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(categories);
  const [seeded, setSeeded] = useState(categories);
  if (seeded !== categories) {
    // Render-phase resync (react-hooks/set-state-in-effect is an error here).
    setSeeded(categories);
    setItems(categories);
  }
  const [, startSave] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [usageError, setUsageError] = useState(false);

  function openDelete(c: CategoryRow) {
    setDeleting(c);
    setUsage(null);
    setUsageError(false);
    categoryUsageAction(c.id).then(setUsage, () => setUsageError(true));
  }

  const byOrder = (a: CategoryRow, b: CategoryRow) =>
    a.display_order - b.display_order;
  const mains = useMemo(
    () => items.filter((c) => !c.parent_id).sort(byOrder),
    [items],
  );
  const subsOf = (id: string) =>
    items.filter((c) => c.parent_id === id).sort(byOrder);
  const siblingsOf = (c: CategoryRow) =>
    c.parent_id ? subsOf(c.parent_id) : mains;

  const countFor = (id: string) =>
    products.filter((p) => p.category_id === id || p.subcategory_id === id)
      .length;

  /** Apply a new order to one sibling group locally, then persist it. */
  function commitOrder(group: CategoryRow[]) {
    const order = new Map(group.map((c, i) => [c.id, i + 1]));
    setItems((prev) =>
      prev.map((c) =>
        order.has(c.id) ? { ...c, display_order: order.get(c.id)! } : c,
      ),
    );
    startSave(async () => {
      const res = await reorderCategoriesAction(group.map((c) => c.id));
      if (res.error) {
        toast({
          title: "Order not saved",
          description: res.error,
          variant: "error",
        });
        setItems(categories);
      } else router.refresh();
    });
  }

  function move(c: CategoryRow, delta: -1 | 1) {
    const group = siblingsOf(c);
    const i = group.findIndex((g) => g.id === c.id);
    const j = i + delta;
    if (j < 0 || j >= group.length) return;
    const next = [...group];
    [next[i], next[j]] = [next[j], next[i]];
    commitOrder(next);
  }

  // Drag reorders the local copy live as the row passes its siblings; the
  // order is saved once, on drop.
  function dragOver(target: CategoryRow) {
    if (!dragId || dragId === target.id) return;
    const dragged = items.find((c) => c.id === dragId);
    if (!dragged || dragged.parent_id !== target.parent_id) return;
    const group = siblingsOf(dragged).filter((c) => c.id !== dragId);
    const at = group.findIndex((c) => c.id === target.id);
    const draggedIdx = siblingsOf(dragged).findIndex((c) => c.id === dragId);
    const targetIdx = siblingsOf(dragged).findIndex((c) => c.id === target.id);
    group.splice(draggedIdx < targetIdx ? at + 1 : at, 0, dragged);
    const order = new Map(group.map((c, i) => [c.id, i + 1]));
    setItems((prev) =>
      prev.map((c) =>
        order.has(c.id) ? { ...c, display_order: order.get(c.id)! } : c,
      ),
    );
  }

  function dragEnd() {
    const dragged = items.find((c) => c.id === dragId);
    setDragId(null);
    if (!dragged) return;
    const group = siblingsOf(dragged);
    const before = categories
      .filter((c) => c.parent_id === dragged.parent_id)
      .sort(byOrder)
      .map((c) => c.id)
      .join();
    if (group.map((c) => c.id).join() !== before) commitOrder(group);
  }

  function row(c: CategoryRow, sub: boolean) {
    const group = siblingsOf(c);
    const idx = group.findIndex((g) => g.id === c.id);
    const n = countFor(c.id);
    return (
      <li
        key={c.id}
        onDragOver={(e) => {
          e.preventDefault();
          dragOver(c);
        }}
        onDrop={(e) => e.preventDefault()}
        className={cn(
          "flex items-center gap-3 border-t border-dream-line px-3 py-3 first:border-t-0 sm:px-4",
          sub && "bg-dream-bg/60 pl-8 sm:pl-12",
          justAdded?.id === c.id && "bg-dream-sun-soft",
          dragId === c.id && "opacity-50",
        )}
      >
        {/* Drag handle, desktop only (touch has no HTML5 drag). */}
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDragId(c.id);
          }}
          onDragEnd={dragEnd}
          title="Drag to reorder"
          aria-hidden
          className="hidden cursor-grab text-dream-faint hover:text-dream-ink active:cursor-grabbing md:block"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-dream-ink",
              sub ? "text-sm" : "font-semibold",
            )}
          >
            {c.name}
          </div>
          <div className="text-xs text-dream-muted md:hidden">
            {n} {n === 1 ? "product" : "products"}
          </div>
        </div>
        <span className="hidden shrink-0 text-sm tabular-nums text-dream-muted md:block">
          {n} {n === 1 ? "product" : "products"}
        </span>
        {/* Phones: arrows instead of drag. */}
        <div className="flex shrink-0 md:hidden">
          <button
            type="button"
            onClick={() => move(c, -1)}
            disabled={idx === 0}
            aria-label={`Move ${c.name} up`}
            className="grid h-9 w-9 place-items-center rounded-lg text-dream-muted hover:bg-dream-bg disabled:opacity-30"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => move(c, 1)}
            disabled={idx === group.length - 1}
            aria-label={`Move ${c.name} down`}
            className="grid h-9 w-9 place-items-center rounded-lg text-dream-muted hover:bg-dream-bg disabled:opacity-30"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        {/* One quiet action per row, like the products table. Rename and
            delete live in the dialog, so there's no red on every line. */}
        <button
          type="button"
          onClick={() => setRenaming(c)}
          className="shrink-0 text-sm font-medium text-dream-purple hover:underline md:ml-7"
        >
          Edit
        </button>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      {justAdded && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-dream-sun-soft px-4 py-3 text-sm text-dream-ink">
          <span>
            Added <b>{justAdded.name}</b>. Pick it as the category on any
            product to put it in the shop.
          </span>
          {backTo && (
            <Link
              href={`/admin/products/${backTo.id}`}
              className="font-semibold text-dream-purple hover:underline"
            >
              Back to {backTo.name}
            </Link>
          )}
        </div>
      )}

      <ul className="overflow-hidden rounded-xl border border-dream-line bg-dream-surface">
        {mains.map((m) => [
          row(m, false),
          ...subsOf(m.id).map((s) => row(s, true)),
        ])}
      </ul>

      <AddCategoryDialog
        open={addOpen}
        onOpenChange={onAddOpenChange}
        mains={mains}
        items={items}
        onAdded={(cat) => {
          setJustAdded(cat);
          router.refresh();
        }}
      />
      <RenameDialog
        category={renaming}
        items={items}
        onClose={() => setRenaming(null)}
        onDone={() => router.refresh()}
        onDelete={(c) => {
          setRenaming(null);
          openDelete(c);
        }}
      />
      <DeleteDialog
        category={deleting}
        usage={usage}
        usageError={usageError}
        onClose={() => setDeleting(null)}
        onDone={(name) => {
          toast({ title: `Deleted ${name}`, variant: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

function sameNameExists(
  items: CategoryRow[],
  name: string,
  parentId: string | null,
  exceptId?: string,
) {
  const n = name.trim().toLowerCase();
  return (
    !!n &&
    items.some(
      (c) =>
        c.id !== exceptId &&
        (c.parent_id ?? null) === parentId &&
        c.name.trim().toLowerCase() === n,
    )
  );
}

/** Also used by the product editor's "+ New category" option. */
export function AddCategoryDialog({
  open,
  onOpenChange,
  mains,
  items,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mains: CategoryRow[];
  items: CategoryRow[];
  onAdded: (cat: { id: string; name: string; parentId: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState<"main" | "sub">("main");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parent = placement === "sub" ? parentId || null : null;
  const duplicate = sameNameExists(items, name, parent);
  const canSave =
    !!name.trim() && !duplicate && (placement === "main" || !!parentId);

  function reset() {
    setName("");
    setPlacement("main");
    setParentId("");
    setError(null);
  }

  function close(o: boolean) {
    if (pending) return;
    onOpenChange(o);
    if (!o) reset();
  }

  function save() {
    start(async () => {
      const res = await addCategoryAction({ name, parentId: parent });
      if (res.error || !res.id) {
        setError(res.error ?? "Couldn't add the category. Try again.");
        return;
      }
      onAdded({ id: res.id, name: name.trim(), parentId: parent });
      // Not close(): it bails while this transition is pending.
      onOpenChange(false);
      reset();
    });
  }

  const option = (value: "main" | "sub", label: string, hint?: string) => (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm",
        placement === value
          ? "border-dream-purple bg-dream-lavender-mist"
          : "border-dream-line",
      )}
    >
      {/* Inputs are appearance:none site-wide (globals.css), so the dot is drawn. */}
      <input
        type="radio"
        name="category-placement"
        checked={placement === value}
        onChange={() => setPlacement(value)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-dream-purple/40",
          placement === value
            ? "border-[5px] border-dream-purple"
            : "border-dream-line-strong",
        )}
      />
      <span>
        <span className="font-medium text-dream-ink">{label}</span>
        {hint && <span className="block text-dream-muted">{hint}</span>}
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
        </DialogHeader>
        <form
          id="add-category-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save();
          }}
          className="space-y-4 px-5 pb-5"
        >
          <Field
            label="Name"
            htmlFor="new-category-name"
            error={
              duplicate
                ? `There's already a category called ${name.trim()}.`
                : (error ?? undefined)
            }
          >
            <Input
              id="new-category-name"
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Quarter Zips"
            />
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-dream-ink">
              Where does it go?
            </legend>
            {option("main", "Main category")}
            {option(
              "sub",
              "Under another category",
              "e.g. Hoodies > Quarter Zips",
            )}
            {placement === "sub" && (
              <Select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                aria-label="Main category to put it under"
              >
                <option value="">Choose a main category</option>
                {mains.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
          </fieldset>
        </form>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => close(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="add-category-form"
            loading={pending}
            disabled={!canSave}
          >
            Add category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({
  category,
  items,
  onClose,
  onDone,
  onDelete,
}: {
  category: CategoryRow | null;
  items: CategoryRow[];
  onClose: () => void;
  onDone: () => void;
  /** Hands off to the delete confirmation (which checks what's in it). */
  onDelete: (category: CategoryRow) => void;
}) {
  const [name, setName] = useState("");
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Seed the field when a new category is opened (render-phase adjust, not an effect).
  if (category && seededFor !== category.id) {
    setSeededFor(category.id);
    setName(category.name);
    setError(null);
  }

  const duplicate =
    !!category &&
    sameNameExists(items, name, category.parent_id ?? null, category.id);
  const unchanged = name.trim() === category?.name;
  const canSave = !!name.trim() && !duplicate && !unchanged;

  function close() {
    if (pending) return;
    setSeededFor(null);
    onClose();
  }

  return (
    <Dialog open={!!category} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {category?.name}</DialogTitle>
        </DialogHeader>
        <form
          id="rename-category-form"
          className="px-5 pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!category || !canSave) return;
            start(async () => {
              const res = await renameCategoryAction(category.id, name);
              if (res.error) {
                setError(res.error);
                return;
              }
              onDone();
              setSeededFor(null);
              onClose();
            });
          }}
        >
          <Field
            label="Name"
            htmlFor="rename-category-name"
            error={
              duplicate
                ? `There's already a category called ${name.trim()}.`
                : (error ?? undefined)
            }
          >
            <Input
              id="rename-category-name"
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </Field>
        </form>
        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              if (!category || pending) return;
              setSeededFor(null);
              onDelete(category);
            }}
            disabled={pending}
            className="mr-auto text-sm font-medium text-dream-danger hover:underline disabled:opacity-50"
          >
            Delete category
          </button>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="rename-category-form"
            loading={pending}
            disabled={!canSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type CategoryUsage = Awaited<ReturnType<typeof categoryUsageAction>>;

function DeleteDialog({
  category,
  usage,
  usageError,
  onClose,
  onDone,
}: {
  category: CategoryRow | null;
  usage: CategoryUsage | null;
  usageError: boolean;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const error =
    actionError ??
    (usageError ? "Couldn't check what's in this category." : null);

  const blocked =
    !!usage && (usage.productCount > 0 || usage.subcategories.length > 0);

  function close() {
    if (pending) return;
    setActionError(null);
    onClose();
  }

  const moreProducts = usage ? usage.productCount - usage.products.length : 0;

  return (
    <Dialog open={!!category} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {category?.name}?</DialogTitle>
          {usage && !blocked && (
            <DialogDescription>
              It comes off the shop and the product editor. This can&apos;t be
              undone.
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="px-5 pb-5 empty:hidden">
          {!usage && !error && (
            <p className="text-sm text-dream-muted">
              Checking what&apos;s in it...
            </p>
          )}
          {usage && usage.productCount > 0 && (
            <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-ink">
              {usage.productCount}{" "}
              {usage.productCount === 1 ? "product is" : "products are"} in{" "}
              {category?.name}: {usage.products.join(", ")}
              {moreProducts > 0 && ` and ${moreProducts} more`}. Move{" "}
              {usage.productCount === 1 ? "it" : "them"} to another category
              first.
            </p>
          )}
          {usage &&
            usage.productCount === 0 &&
            usage.subcategories.length > 0 && (
              <p className="rounded-lg bg-dream-danger-soft px-3 py-2 text-sm text-dream-ink">
                {category?.name} still has sub-categories:{" "}
                {usage.subcategories.join(", ")}. Delete those first.
              </p>
            )}
          {error && <p className="text-sm text-dream-danger">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={pending}>
            {blocked ? "Close" : "Cancel"}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={!usage || blocked}
            onClick={() => {
              if (!category) return;
              start(async () => {
                const res = await deleteCategoryAction(category.id);
                if (res.error) {
                  setActionError(res.error);
                  return;
                }
                onDone(category.name);
                // Not close(): it bails while this transition is pending.
                setActionError(null);
                onClose();
              });
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
