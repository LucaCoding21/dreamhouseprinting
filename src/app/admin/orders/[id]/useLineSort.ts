"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Pointer-driven reordering for an order's lines.
 *
 * Expanded line cards can each be taller than the screen, which made the old
 * HTML5 drag miserable: every drop target was a page long and the browser's
 * edge auto-scroll crawled. So grabbing a grip flips the list into a compact
 * "reorder mode" (every line one short row) for the length of the drag, keeps
 * the grabbed row under the cursor, slides the other rows out of its way, and
 * scrolls the page when the pointer nears the top or bottom edge. Releasing
 * commits via onDrop(from, to); Escape or a cancelled pointer puts it back.
 *
 * Pointer events (not HTML5 DnD) so it also works with touch and a pen.
 *
 * The caller renders the compact list inside `listRef` with `data-sort-row` on
 * each row, and applies `rowStyle(i)` to row i.
 */
type SortState = {
  id: string;
  from: number;
  /** Target index the grabbed line would land at (0-based, after removal). */
  over: number;
  /** translateY for the grabbed row, in px. */
  dy: number;
  /** How far the other rows shift to make room: grabbed height + gap. */
  shift: number;
};

type Geo = {
  scroller: HTMLElement;
  /** Row centres in scroller content coordinates, measured at drag start. */
  centres: number[];
  /** Pointer distance from the grabbed row's centre at drag start. */
  grab: number;
  y: number;
  over: number;
};

const EDGE = 80; // px from the scroller edge where auto-scroll kicks in
const MAX_SPEED = 18; // px per frame at the very edge

function scrollParent(el: HTMLElement | null): HTMLElement {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement as HTMLElement;
}

export function useLineSort(count: number) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  // A drag in flight when the section unmounts must not leave listeners behind.
  useEffect(() => () => cleanup.current?.(), []);

  function start(id: string, from: number, e: React.PointerEvent, onDrop: (from: number, to: number) => void) {
    if (e.button !== 0 || count < 2) return;
    e.preventDefault();
    const y0 = e.clientY;

    // Mount the compact list synchronously so it can be measured right away.
    flushSync(() => setSort({ id, from, over: from, dy: 0, shift: 0 }));
    const list = listRef.current;
    if (!list) return setSort(null);
    const scroller = scrollParent(list);
    const rows = () => Array.from(list.querySelectorAll<HTMLElement>("[data-sort-row]"));

    // Collapsing the cards moved everything: bring the grabbed row back under
    // the pointer so it feels like you picked up the row you pressed on.
    const grabbed = rows()[from];
    if (grabbed) {
      const r = grabbed.getBoundingClientRect();
      scroller.scrollTop += r.top + r.height / 2 - y0;
    }

    const sTop = () => (scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top);
    const rects = rows().map((r) => r.getBoundingClientRect());
    const toContent = (clientY: number) => clientY - sTop() + scroller.scrollTop;
    const centres = rects.map((r) => toContent(r.top + r.height / 2));
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    const shift = (rects[from]?.height ?? 0) + gap;
    const geo: Geo = { scroller, centres, grab: toContent(y0) - centres[from], y: y0, over: from };

    const update = () => {
      const centre = toContent(geo.y) - geo.grab;
      let over = 0;
      geo.centres.forEach((c, j) => {
        if (j !== from && c < centre) over++;
      });
      geo.over = over;
      setSort({ id, from, over, dy: centre - geo.centres[from], shift });
    };
    update();

    let raf = 0;
    const tick = () => {
      const h = scroller === document.scrollingElement ? window.innerHeight : scroller.clientHeight;
      const rel = geo.y - sTop();
      const speed =
        rel < EDGE ? -MAX_SPEED * (1 - Math.max(rel, 0) / EDGE) : rel > h - EDGE ? MAX_SPEED * (1 - Math.max(h - rel, 0) / EDGE) : 0;
      if (speed) {
        const before = scroller.scrollTop;
        scroller.scrollTop += speed;
        if (scroller.scrollTop !== before) update();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (ev: PointerEvent) => {
      geo.y = ev.clientY;
      update();
    };
    const finish = (commit: boolean) => {
      cleanup.current?.();
      const to = geo.over;
      setSort(null);
      // Next frame, once the full cards are back, so the move's scroll-to
      // lands on the real card.
      if (commit && to !== from) requestAnimationFrame(() => onDrop(from, to));
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") finish(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    cleanup.current = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = "";
      cleanup.current = null;
    };
  }

  /** Transform for row i while sorting: the grabbed row follows the pointer,
   *  the rows it has passed slide one slot to fill in behind it. */
  function rowStyle(i: number): React.CSSProperties | undefined {
    if (!sort) return undefined;
    if (i === sort.from) {
      return { transform: `translateY(${sort.dy}px)`, zIndex: 20, position: "relative" };
    }
    let y = 0;
    if (sort.from < sort.over && i > sort.from && i <= sort.over) y = -sort.shift;
    if (sort.over < sort.from && i >= sort.over && i < sort.from) y = sort.shift;
    return { transform: `translateY(${y}px)`, transition: "transform 160ms ease-out", position: "relative" };
  }

  return { listRef, sort, start, rowStyle };
}
