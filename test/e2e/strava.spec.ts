import { expect, test } from "@playwright/test";
import { openApp, stageSnapshot, tab } from "./helpers";

/**
 * §7.2 sign-in, with the Strava API and the config endpoint mocked. The point of these is
 * the behaviour the old app got wrong: a connection that survives, and honesty about it
 * when it cannot.
 */

const CONFIGURED = { configured: true, clientId: "12345", scope: "read,activity:read_all" };

async function mockConfig(page: import("@playwright/test").Page, body: unknown) {
  await page.route("**/api/strava/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("offers a one-tap sign-in when the deployment is configured", async ({ page }) => {
  await mockConfig(page, CONFIGURED);
  await openApp(page);

  await page.getByRole("button", { name: "Connect Strava" }).click();
  const signIn = page.locator("[data-testid='strava-signin']");
  await expect(signIn).toBeVisible();
  await expect(page.locator(".modal")).toContainText("Sign in once");
  // It promises what the serverless refresh actually delivers.
  await expect(page.locator(".modal")).toContainText("not drop every six hours");
});

test("sends the browser to Strava with the right parameters", async ({ page }) => {
  await mockConfig(page, CONFIGURED);
  await openApp(page);

  // Intercept the redirect rather than following it off-site.
  let authorizeUrl = "";
  await page.route("https://www.strava.com/oauth/authorize*", (route) => {
    authorizeUrl = route.request().url();
    return route.fulfill({ status: 200, contentType: "text/html", body: "<html>strava</html>" });
  });

  await page.getByRole("button", { name: "Connect Strava" }).click();
  await page.locator("[data-testid='strava-signin']").click();
  await page.waitForURL(/strava\.com|dist\/index\.html/, { timeout: 10_000 }).catch(() => {});

  expect(authorizeUrl).toContain("client_id=12345");
  expect(authorizeUrl).toContain("response_type=code");
  expect(authorizeUrl).toContain("activity%3Aread_all");
  // The redirect URI must be the app's own URL, with no query or fragment.
  expect(authorizeUrl).toContain("dist%2Findex.html");
  expect(authorizeUrl).not.toContain("client_secret");
});

test("says plainly when sign-in is not configured, and still offers the token fallback", async ({ page }) => {
  await mockConfig(page, { configured: false, clientId: "", scope: "" });
  await openApp(page);

  await page.getByRole("button", { name: "Connect Strava" }).click();
  await expect(page.locator("[data-testid='strava-unconfigured']")).toBeVisible();
  await expect(page.locator("[data-testid='strava-unconfigured']")).toContainText("callback domain");
  // The advanced fallback is still there for testers.
  await expect(page.locator("[data-testid='token-input']")).toBeAttached();
});

test("completes the redirect back from Strava and lists activities", async ({ page }) => {
  await mockConfig(page, CONFIGURED);

  await page.route("**/api/strava/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "at",
        refresh_token: "rt",
        expires_at: Math.floor(Date.now() / 1000) + 21600,
        athlete: { firstname: "George", id: 7 },
      }),
    }),
  );
  await page.route("**/api/v3/athlete/activities*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 101,
          name: "Thursday tempo",
          sport_type: "Run",
          start_date_local: "2026-09-04T06:42:00Z",
          distance: 12100,
          moving_time: 3492,
        },
      ]),
    }),
  );

  await page.goto("/dist/index.html?code=abc123&scope=read,activity:read_all");
  await page.waitForSelector("[data-testid='stage']");

  await expect(page.locator(".modal")).toContainText("Connected as George");
  await expect(page.locator("[data-testid='strava-act-101']")).toContainText("Thursday tempo");
  // Strava's attribution requirement (§7.2).
  await expect(page.locator(".modal")).toContainText("Compatible with Strava");

  // The code is stripped from the URL, so a refresh does not try to exchange it twice.
  expect(await page.evaluate(() => window.location.search)).toBe("");
});

test("picking an activity redraws the design with the real data", async ({ page }) => {
  await mockConfig(page, CONFIGURED);
  await page.route("**/api/strava/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "at",
        refresh_token: "rt",
        expires_at: Math.floor(Date.now() / 1000) + 21600,
        athlete: { firstname: "George" },
      }),
    }),
  );
  await page.route("**/api/v3/athlete/activities*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 101,
          name: "Wandsworth loop",
          sport_type: "Run",
          start_date_local: "2026-09-04T06:42:00Z",
          distance: 10000,
          moving_time: 2700,
        },
      ]),
    }),
  );
  await page.route("**/api/v3/activities/101?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ calories: 640, splits_metric: [] }),
    }),
  );
  await page.route("**/api/v3/activities/101/streams*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ heartrate: { data: [120, 140, 160] } }),
    }),
  );

  await page.goto("/dist/index.html?code=abc123");
  await page.waitForSelector("[data-testid='strava-act-101']");

  // The activity card that used to carry these numbers lived in the Stats tab, which is
  // gone. What matters is that picking the activity actually applies it, and the canvas is
  // where that shows.
  const before = await stageSnapshot(page);
  await page.locator("[data-testid='strava-act-101']").click();
  await expect.poll(async () => (await stageSnapshot(page)) !== before, { timeout: 5000 }).toBe(true);
});

test("explains a callback-domain mismatch instead of failing silently", async ({ page }) => {
  await mockConfig(page, CONFIGURED);
  await page.route("**/api/strava/token", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "strava_rejected" }),
    }),
  );

  await page.goto("/dist/index.html?code=bad");
  await page.waitForSelector("[data-testid='stage']");
  await expect(page.locator("[data-testid='strava-status']")).toContainText("callback domain");
});

test("a cancelled sign-in says so", async ({ page }) => {
  await mockConfig(page, CONFIGURED);
  await page.goto("/dist/index.html?error=access_denied");
  await page.waitForSelector("[data-testid='stage']");
  await expect(page.locator("[data-testid='strava-status']")).toContainText("cancelled");
});
