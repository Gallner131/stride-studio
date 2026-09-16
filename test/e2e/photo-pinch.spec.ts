import { expect, test } from "@playwright/test";
import { FIXTURE_PHOTO, openApp } from "./helpers";

/**
 * §6.13 — two fingers frame the photo.
 *
 * With nothing selected, a pinch adjusts the photo rather than the layers: that is what the
 * gesture means to anyone who has used a phone. Before this you could zoom a photo but not
 * choose what you were zooming into, so the middle of the frame was the only thing you could
 * ever show.
 */
test("pinching with nothing selected reframes the photo", async ({ page }) => {
  await openApp(page);
  await page.setInputFiles("[data-testid='file-input']", FIXTURE_PHOTO);
  await page.waitForTimeout(7500);

  const shot = () =>
    page.evaluate(() => {
      const c = document.querySelector("[data-testid='stage']") as HTMLCanvasElement | null;
      return c ? c.toDataURL("image/png") : "";
    });
  const before = await shot();

  // Two pointers, spread apart and slid upward.
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid='overlay']") as HTMLElement;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const send = (type: string, pts: Array<[number, number, number]>) => {
      for (const [id, x, y] of pts) {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: "touch",
            clientX: x,
            clientY: y,
            bubbles: true,
            isPrimary: id === 1,
          }),
        );
      }
    };
    el.setPointerCapture = () => undefined;
    el.releasePointerCapture = () => undefined;
    send("pointerdown", [
      [1, cx - 40, cy],
      [2, cx + 40, cy],
    ]);
    for (const [d, dy] of [
      [80, -20],
      [130, -50],
      [180, -90],
    ] as Array<[number, number]>) {
      send("pointermove", [
        [1, cx - d, cy + dy],
        [2, cx + d, cy + dy],
      ]);
    }
    send("pointerup", [
      [1, cx - 180, cy - 90],
      [2, cx + 180, cy - 90],
    ]);
  });

  await page.waitForTimeout(1500);
  expect(await shot()).not.toBe(before);
});
