/**
 * S&S CDN image size variants. Client-safe (no credentials, pure string ops).
 *
 * S&S publishes every colour photo at three sizes, selected by the filename
 * suffix: `_fs` (small, ~150px), `_fm` (medium, 500x625) and `_fl` (large,
 * 1000x1250). The catalog stores the medium URL, which is the right weight for
 * shop cards and thumbnails, but the designer canvases draw the garment at up
 * to ~1,600 device pixels wide (520px x 1.6 zoom x retina) and the mockup
 * export renders at ~1,600px too, so the medium photo was being upscaled 3x
 * and read as "low quality". Canvases should load the large variant instead.
 */

const SIZE_SUFFIX = /_f(s|m|l)\.(jpe?g|png|webp)$/i;

/** Swap an S&S colour-photo URL to its large (1000x1250) variant. Non-S&S
 *  URLs and URLs without a size suffix are returned unchanged. */
export function ssLargeImage(url: string): string {
  return url.replace(SIZE_SUFFIX, "_fl.$2");
}

/** True when `url` is a large S&S variant (so a failed load can fall back to
 *  the stored medium URL instead of showing nothing). */
export function isSsLargeImage(url: string): boolean {
  return /_fl\.(jpe?g|png|webp)$/i.test(url);
}
