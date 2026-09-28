/**
 * Smooth-scroll an element to the middle of the screen. A block taller than
 * the viewport would have its top (the part you want to see) cut off when
 * centred, so those line up with the top instead.
 */
export function scrollToCenter(el: HTMLElement | null) {
  if (!el) return;
  const tall = el.getBoundingClientRect().height > window.innerHeight * 0.8;
  el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" });
}
