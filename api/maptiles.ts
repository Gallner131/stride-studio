// Map backgrounds — §2.12.
//
// Proxies Mapbox's Static Images API so the token never reaches the browser. A Mapbox token
// in client code is a token anyone can lift out of the bundle and spend against your
// account, and this app ships as one inlined index.html, so "in the bundle" means "in plain
// sight". The browser asks this function; this function holds the token.
//
// It also pins the parameters. The client sends a bounding box and a style id and nothing
// else — no arbitrary URL, no arbitrary size — so a forged request cannot turn this into an
// open proxy for someone else's Mapbox traffic.

const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? "";

/** The styles offered in the UI, mapped to Mapbox style ids. Nothing else is accepted. */
const STYLES: Record<string, string> = {
  outdoors: "mapbox/outdoors-v12",
  streets: "mapbox/streets-v12",
  light: "mapbox/light-v11",
  dark: "mapbox/dark-v11",
  satellite: "mapbox/satellite-v9",
};

/** Static Images caps a single request at 1280x1280. */
const MAX_PX = 1280;

/**
 * A polyline longer than this will not fit in a URL. The client thins to ~240 points, which
 * encodes to well under it; this is the backstop against a forged request.
 */
const MAX_PATH = 6000;

export const config = { runtime: "edge" };

const bad = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });

export default async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  if (ALLOWED_ORIGIN !== "" && origin !== "" && origin !== ALLOWED_ORIGIN) {
    return bad(403, "origin not allowed");
  }

  const token = process.env.MAPBOX_TOKEN ?? "";
  // A first-class "not configured" answer, so the app can hide the Map background rather
  // than offering one that returns a broken image.
  if (token === "") return bad(503, "map backgrounds are not configured");

  const url = new URL(request.url);
  const style = STYLES[url.searchParams.get("style") ?? "outdoors"];
  if (!style) return bad(400, "unknown style");

  const num = (key: string) => Number.parseFloat(url.searchParams.get(key) ?? "");
  const [west, south, east, north] = [num("w"), num("s"), num("e"), num("n")];
  if (![west, south, east, north].every(Number.isFinite)) return bad(400, "bad bounding box");
  if (west < -180 || east > 180 || south < -85 || north > 85 || west >= east || south >= north) {
    return bad(400, "bounding box out of range");
  }

  const width = Math.min(MAX_PX, Math.max(64, Math.round(num("width") || 720)));
  const height = Math.min(MAX_PX, Math.max(64, Math.round(num("height") || 1280)));
  const retina = url.searchParams.get("retina") === "1" ? "@2x" : "";

  // Mapbox draws the route, rather than the app drawing it over the top.
  //
  // The image is fitted to a bounding box and then cover-cropped onto the canvas, while the
  // app projects its own route into a layer box — two different projections, so the line ran
  // beside the roads instead of along them. One projection fixes it, and it stays fixed at
  // any zoom or pan because the line is part of the picture.
  //
  // Two strokes: a dark casing under a bright line, so the route reads on a pale street map
  // and on satellite alike.
  const path = url.searchParams.get("path") ?? "";
  if (path.length > MAX_PATH) return bad(400, "route too long");
  const encoded = encodeURIComponent(path);
  const overlay = path ? `path-9+000000-0.35(${encoded}),path-5+ffffff-1(${encoded})/` : "";

  const upstream =
    `https://api.mapbox.com/styles/v1/${style}/static/${overlay}` +
    `[${west},${south},${east},${north}]/${width}x${height}${retina}` +
    `?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`;

  const res = await fetch(upstream);
  if (!res.ok) return bad(res.status === 401 ? 503 : 502, "map service unavailable");

  return new Response(res.body, {
    status: 200,
    headers: {
      "content-type": res.headers.get("content-type") ?? "image/png",
      ...(origin ? { "access-control-allow-origin": origin } : {}),
      // A bounding box maps to one immutable picture, so this can be cached hard. It is also
      // what keeps the Mapbox bill down: the same route redrawn is served from the edge.
      "cache-control": "public, max-age=31536000, immutable",
      // Mapbox requires visible attribution. `attribution=false` above removes it from the
      // image so it can be placed legibly in the design instead; the app draws it.
      "x-map-attribution": "© Mapbox © OpenStreetMap",
    },
  });
}
