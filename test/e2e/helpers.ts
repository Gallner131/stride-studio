import { resolve } from "node:path";
import type { Page } from "@playwright/test";

/** The built single-file app (§1.3: the AirDrop-able dist/index.html stays). */
export const APP_URL = "/dist/index.html";

export const FIXTURE_PHOTO = resolve(import.meta.dirname, "../fixtures/media/fixture-photo.png");

export async function openApp(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(APP_URL);
  await page.waitForSelector("[data-testid='stage']");
  return errors;
}

export type TabName = "Designs" | "Look" | "Add" | "Layers";

/**
 * Clicks one of the control tabs.
 *
 * Addressed by test id rather than label: tab labels collide with other controls ("Stats"
 * is also a template category chip) and the Layers tab carries a live count, so no
 * text-based selector is stable.
 */
/**
 * Clears the selection if there is one.
 *
 * Selecting an element turns the panel into that element's editor, so the tab content —
 * including the Layers list — is only on screen when nothing is selected.
 */
export async function deselect(page: Page): Promise<void> {
  const button = page.locator("[data-testid='deselect']");
  if ((await button.count()) > 0) await button.click();
}

export async function tab(page: Page, name: TabName): Promise<void> {
  // Selecting an element turns the panel into that element's editor, so no tab content is on
  // screen while something is selected — and from step 2 the tab bar itself is hidden. Going
  // to a tab therefore means leaving the element you were editing.
  await deselect(page);
  await page.locator(`[data-testid='tab-${name.toLowerCase()}']`).click();
}

/** Attaches the fixture photo and waits for the image decode to reach the canvas. */
export async function addFixturePhoto(page: Page): Promise<void> {
  await page.setInputFiles("[data-testid='file-input']", FIXTURE_PHOTO);
  // The photo prompt unmounts once media is set, which is the observable signal that
  // onFile's img.onload has fired.
  await page.waitForSelector("[data-testid='add-media']", { state: "detached" });
}

/** Reads the preview canvas as a base64 PNG, for change detection between actions. */
export async function stageSnapshot(page: Page): Promise<string> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-testid='stage']");
    if (!c) throw new Error("no stage canvas");
    return c.toDataURL("image/png");
  });
}

export interface ExportedImage {
  width: number;
  height: number;
  /** Alpha of the four corner pixels, 0-255. */
  cornerAlpha: number[];
  /** Whether any pixel in the image is fully opaque. */
  hasOpaquePixels: boolean;
}

/**
 * Inspects the exported image shown in the result modal: real dimensions plus the corner
 * transparency that distinguishes a full export from a sticker export (§9.2).
 */
export async function inspectResultImage(page: Page): Promise<ExportedImage> {
  await page.waitForSelector("[data-testid='result-image']");
  return page.evaluate(async () => {
    const img = document.querySelector<HTMLImageElement>("[data-testid='result-image']");
    if (!img) throw new Error("no result image");
    if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));

    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0);

    const at = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3] ?? 0;
    const cornerAlpha = [at(0, 0), at(c.width - 1, 0), at(0, c.height - 1), at(c.width - 1, c.height - 1)];

    const all = ctx.getImageData(0, 0, c.width, c.height).data;
    let hasOpaquePixels = false;
    for (let i = 3; i < all.length; i += 4) {
      if (all[i] === 255) {
        hasOpaquePixels = true;
        break;
      }
    }

    return { width: img.naturalWidth, height: img.naturalHeight, cornerAlpha, hasOpaquePixels };
  });
}
