// Public Strava configuration — §7.2.
//
// The client ID is public by design (it appears in the authorize URL), but it should not be
// hardcoded in the repo: that would tie the build to one Strava app and leak the ID into
// every fork. The client SECRET is never returned here, or anywhere near the browser.
//
// `configured: false` is a first-class answer, so the app can offer the manual token
// fallback and say why, rather than showing a Connect button that goes nowhere.

const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? "";

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGIN === "" ? true : origin === "" || origin === ALLOWED_ORIGIN;

  const clientId = process.env.STRAVA_CLIENT_ID ?? "";

  return new Response(
    JSON.stringify({
      configured: clientId !== "" && (process.env.STRAVA_CLIENT_SECRET ?? "") !== "",
      clientId,
      scope: "read,activity:read_all",
    }),
    {
      status: allowed ? 200 : 403,
      headers: {
        "content-type": "application/json",
        ...(origin && allowed ? { "access-control-allow-origin": origin } : {}),
        // Short cache: the answer changes only when the env vars change.
        "cache-control": "public, max-age=300",
      },
    },
  );
}
