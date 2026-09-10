// Strava token exchange — §7.2.
//
// This function exists for one reason: Strava does not support PKCE and requires the client
// SECRET for the code exchange. Doing that in the browser means shipping the secret to
// every user, which is what the current app does (§1.2 E1) and what makes it unshippable
// for anyone but its author.
//
// The secret lives in Vercel's environment and never reaches the client. Tokens are
// returned to the caller and stored on the device; nothing is logged and nothing is
// persisted here.

interface TokenRequest {
  code?: string;
}

const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? "";

const json = (body: unknown, status: number, origin: string): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      // Same-origin only. An empty APP_ORIGIN means no cross-origin use at all.
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

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": allowed ? origin : "",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    });
  }

  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, "");
  if (!allowed) return json({ error: "origin_not_allowed" }, 403, "");

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return json({ error: "not_configured" }, 500, origin);
  }

  let body: TokenRequest;
  try {
    body = (await request.json()) as TokenRequest;
  } catch {
    return json({ error: "bad_request" }, 400, origin);
  }

  if (!body.code) return json({ error: "missing_code" }, 400, origin);

  try {
    const response = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: body.code,
        grant_type: "authorization_code",
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      // Pass Strava's own message through, but never the request we sent it.
      return json({ error: "strava_rejected", message: data.message ?? null }, response.status, origin);
    }

    return json(
      {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        athlete: data.athlete,
      },
      200,
      origin,
    );
  } catch {
    return json({ error: "upstream_unavailable" }, 502, origin);
  }
}
