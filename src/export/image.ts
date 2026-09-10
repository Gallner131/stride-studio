// Image and sticker export — §9.1, §9.2.
//
// Two things the current app gets wrong and this fixes: the sticker export is a full-frame
// transparent PNG rather than a tight crop, and there is no 2x or JPEG option.

import { unionBounds } from "../engine/layout";
import type { Placed } from "../model/types";

export type ImageFormat = "png" | "jpeg";

export interface ExportSize {
  /** Output width in device pixels. */
  width: number;
  label: string;
}

/** §9.1: 1x is 1080 wide, 2x is 2160. */
export const EXPORT_SIZES: ExportSize[] = [
  { width: 1080, label: "1x · 1080" },
  { width: 2160, label: "2x · 2160" },
];

export const STICKER_PADDING = 40;

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The tight crop for a sticker export — the union of the placed layers, padded, clamped to
 * the canvas.
 *
 * Returns null when there is nothing to crop to, so the caller can fall back to the full
 * frame rather than producing a zero-sized image.
 */
export function stickerCrop(
  placed: Placed[],
  canvas: { w: number; h: number },
  scale: number,
  padding = STICKER_PADDING,
): CropRect | null {
  if (placed.length === 0) return null;

  const bounds = unionBounds(placed);
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;

  const pad = padding / scale;
  const x = Math.max(0, bounds.x - pad);
  const y = Math.max(0, bounds.y - pad);
  const right = Math.min(canvas.w, bounds.x + bounds.w + pad);
  const bottom = Math.min(canvas.h, bounds.y + bounds.h + pad);

  const w = right - x;
  const h = bottom - y;
  if (w <= 1 || h <= 1) return null;

  return { x, y, w, h };
}

/** Crops a canvas to a rect in canvas units, at the given device scale. */
export function cropCanvas(source: HTMLCanvasElement, rect: CropRect, scale: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(rect.w * scale));
  out.height = Math.max(1, Math.round(rect.h * scale));
  const ctx = out.getContext("2d");
  if (ctx) {
    ctx.drawImage(
      source,
      Math.round(rect.x * scale),
      Math.round(rect.y * scale),
      out.width,
      out.height,
      0,
      0,
      out.width,
      out.height,
    );
  }
  return out;
}

export const toBlob = (canvas: HTMLCanvasElement, format: ImageFormat): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob(
      resolve,
      format === "jpeg" ? "image/jpeg" : "image/png",
      format === "jpeg" ? 0.92 : undefined,
    );
  });

/**
 * File name per §9.1: stride-{name}-{distance}{unit}-{yyyymmdd}.{ext}
 *
 * The slug is ASCII-only, because a filename with an em-dash or an accent survives the
 * share sheet on iOS but not every Android target.
 */
export function exportFileName(
  activityName: string,
  distance: string | null,
  unit: string,
  date: string | Date,
  ext: string,
): string {
  const slug = (activityName || "activity")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40);

  const d = typeof date === "string" ? new Date(date) : date;
  const stamp = Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  return ["stride", slug, distance ? `${distance}${unit}` : null, stamp]
    .filter(Boolean)
    .join("-")
    .concat(`.${ext}`);
}

/**
 * Copies an image to the clipboard — §9.2, so a sticker can be pasted straight into
 * Instagram's Story composer on iOS.
 *
 * Only PNG: Safari's clipboard rejects JPEG in a ClipboardItem.
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

/** True when a transparent PNG has at least one fully opaque pixel — i.e. it is not empty. */
export function hasContent(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  try {
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 0) > 8) return true;
    }
  } catch {
    return true; // cannot tell; assume it is fine rather than blocking an export
  }
  return false;
}
