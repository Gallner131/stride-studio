// Strava token refresh — §7.2.
//
// Access tokens last six hours. Without this, every user re-authenticates three times a day
// (§1.2 E1). With it, they sign in once — which is the §2.6 target of "never during normal
// use".

interface RefreshRequest {
  refresh_token?: string;
}

const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? "";

const json = (body: unknown, status: number, origin: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(origin ? { "access-control-allow-origin": origin } : {}),
      "cache-control": "no-store",
    },
  });

// Web-standard Request/Response handler, so it runs on the edge runtime rather than the
// Node one — the Node runtime expects (req, res) and cannot invoke this signature.
export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGIN === "" ? origin === "" : origin === ALLOWED_ORIGIN;

  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, "");
  if (!allowed) return json({ error: "origin_not_allowed" }, 403, "");

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: "not_configured" }, 500, origin);

  let body: RefreshRequest;
  try {
    body = (await request.json()) as RefreshRequest;
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }
  if (!body.refresh_token) return json({ error: "missing_refresh_token" }, 400, origin);

  try {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: body.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return json({ error: "strava_rejected", message: data.message ?? null }, response.status, origin);
    }

    return json(
      {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      },
      200,
      origin,
    );
  } catch {
    return json({ error: "upstream_unavailable" }, 502, origin);
  }
}
