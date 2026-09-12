// Strava client flow — §7.2.
//
// The whole point of this module is that the user signs in ONCE. The old flow asked people
// to paste an access token that Strava expires after six hours (§1.2 E1), which is why the
// connection kept dropping — and pasting a token is not something anyone will do on a phone.
//
// Here: tap Connect, authorise on Strava, land back signed in, and the token refreshes
// itself in the background from then on. The client secret never touches the browser; the
// exchange and the refresh both go through the serverless functions.

const STORAGE_KEY = "stride.strava";

/** Refresh this long before expiry, so a request never races the deadline. */
const REFRESH_MARGIN_SECONDS = 300;

export interface StravaSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  athleteName?: string;
  athleteId?: number;
  /**
   * The scope Strava actually granted, as returned in the callback query — which is not
   * necessarily the scope we asked for. Undefined on a session stored before we recorded it.
   */
  scope?: string;
  connected: true;
}

export interface StravaConfig {
  configured: boolean;
  clientId: string;
  scope: string;
}

// ---------------------------------------------------------------- storage

export function loadSession(): StravaSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StravaSession> & { token?: string };

    // Migrate the legacy shape, which stored a bare `token` with no refresh token. There is
    // nothing to refresh with, so it is honoured until it expires and then discarded.
    if (!parsed.accessToken && parsed.token) {
      return {
        accessToken: parsed.token,
        refreshToken: "",
        expiresAt: 0,
        connected: true,
      };
    }

    if (!parsed.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? "",
      expiresAt: parsed.expiresAt ?? 0,
      athleteName: parsed.athleteName,
      athleteId: parsed.athleteId,
      scope: parsed.scope,
      connected: true,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: StravaSession | null): void {
  try {
    if (session === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private mode; the session simply will not survive a reload.
  }
}

// ---------------------------------------------------------------- config

export async function fetchConfig(): Promise<StravaConfig> {
  try {
    const res = await fetch("/api/strava/config");
    if (!res.ok) return { configured: false, clientId: "", scope: "" };
    return (await res.json()) as StravaConfig;
  } catch {
    // No serverless functions (a static host, or offline): the manual token path is all
    // that is available, and the UI says so.
    return { configured: false, clientId: "", scope: "" };
  }
}

// ---------------------------------------------------------------- sign in

/** The app's own URL, without query or fragment — Strava must match this exactly. */
export const redirectUri = (): string => `${window.location.origin}${window.location.pathname}`;

/**
 * Sends the browser to Strava's consent screen. Works identically on a phone, which is the
 * reason this exists: it is a plain redirect, not a copied credential.
 */
export interface SignInOptions {
  /**
   * Show Strava's consent screen even if the user has authorised before.
   *
   * `approval_prompt=auto` lets Strava skip that screen and silently reissue a token with
   * whatever scope was granted last time. That is what you want for an ordinary reconnect,
   * and exactly what you do not want when the previous grant was too narrow: the user gets
   * a token that cannot read activities, the activities call 401s, and pressing Connect
   * again reissues the same narrow token forever. Forcing the prompt is the only way back.
   */
  force?: boolean;
}

/** The Strava consent URL. Split out from beginSignIn so it can be tested. */
export function authorizeUrl(config: StravaConfig, redirect: string, options: SignInOptions = {}): string {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("approval_prompt", options.force ? "force" : "auto");
  url.searchParams.set("scope", config.scope || "read,activity:read_all");
  return url.toString();
}

/** Scopes that let us read the activity list. Without one of these the app has nothing. */
const ACTIVITY_SCOPES = ["activity:read_all", "activity:read"];

/**
 * Whether this connection can actually read activities.
 *
 * A session stored before we recorded the granted scope reports true: those connections
 * are, by definition, ones that were already working, and nagging them would be wrong.
 */
export function grantedActivityAccess(session: StravaSession): boolean {
  if (session.scope === undefined) return true;
  const granted = session.scope.split(",").map((s) => s.trim());
  return ACTIVITY_SCOPES.some((s) => granted.includes(s));
}

export function beginSignIn(config: StravaConfig, options: SignInOptions = {}): void {
  window.location.href = authorizeUrl(config, redirectUri(), options);
}

export interface SignInResult {
  session: StravaSession | null;
  error: string | null;
}

/**
 * Handles the redirect back from Strava. Returns null/null when there is no code in the URL,
 * so it is safe to call on every load.
 */
export async function completeSignIn(search: string): Promise<SignInResult> {
  const params = new URLSearchParams(search);
  const code = params.get("code");
  const denied = params.get("error");

  if (denied) return { session: null, error: "Strava sign-in was cancelled." };
  if (!code) return { session: null, error: null };

  try {
    const res = await fetch("/api/strava/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok || typeof data.access_token !== "string") {
      const message = typeof data.message === "string" ? data.message : null;
      return {
        session: null,
        error: message
          ? `Strava refused the sign-in: ${message}`
          : "Strava sign-in failed. The callback domain on your Strava API app may not match this site.",
      };
    }

    const athlete = data.athlete as { firstname?: string; id?: number } | undefined;
    const session: StravaSession = {
      accessToken: data.access_token,
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "",
      expiresAt: typeof data.expires_at === "number" ? data.expires_at : 0,
      athleteName: athlete?.firstname,
      athleteId: athlete?.id,
      // Strava reports what it actually granted here, which may be narrower than we asked
      // for. Recording it is what lets the app notice and offer to ask again.
      scope: params.get("scope") ?? undefined,
      connected: true,
    };
    saveSession(session);
    return { session, error: null };
  } catch {
    return { session: null, error: "Could not reach the sign-in service." };
  }
}

/** Strips the OAuth parameters out of the URL, so a refresh does not re-exchange the code. */
export function clearOAuthParams(): void {
  const url = new URL(window.location.href);
  for (const key of ["code", "scope", "state", "error"]) url.searchParams.delete(key);
  window.history.replaceState({}, "", url.toString());
}

// ---------------------------------------------------------------- refresh

export const needsRefresh = (session: StravaSession, now = Date.now() / 1000): boolean => {
  // A legacy pasted token has no refresh token, so there is nothing to refresh with. It is
  // honoured until it fails and then discarded.
  if (!session.refreshToken) return false;
  // An unknown expiry used to read as "never expires", which left the session pinned to a
  // stale access token for good. refreshSession writes expiresAt: 0 itself whenever Strava
  // omits expires_at, so this is reachable in ordinary use, not just from old storage.
  if (session.expiresAt <= 0) return true;
  return session.expiresAt - now < REFRESH_MARGIN_SECONDS;
};

/**
 * Refreshes an expiring token. This is the function that turns "signs in three times a day"
 * into "signs in once" (§2.6).
 */
export async function refreshSession(session: StravaSession): Promise<SignInResult> {
  if (!session.refreshToken) {
    // A legacy pasted token has nothing to refresh with.
    return { session: null, error: "That connection has expired. Connect Strava again." };
  }

  try {
    const res = await fetch("/api/strava/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok || typeof data.access_token !== "string") {
      return { session: null, error: "Strava sign-in expired. Connect again." };
    }

    const next: StravaSession = {
      ...session,
      accessToken: data.access_token,
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : session.refreshToken,
      expiresAt: typeof data.expires_at === "number" ? data.expires_at : 0,
    };
    saveSession(next);
    return { session: next, error: null };
  } catch {
    return { session: null, error: "Could not reach Strava to refresh the connection." };
  }
}

/** Returns a session with a valid token, refreshing first if it is about to expire. */
export async function validSession(session: StravaSession): Promise<SignInResult> {
  if (!needsRefresh(session)) return { session, error: null };
  return refreshSession(session);
}

// ---------------------------------------------------------------- api

export interface StravaActivitySummary {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date_local?: string;
  distance?: number;
  moving_time?: number;
}

/** Friendly message for the failures that actually happen (§7.2). */
function apiError(status: number): string {
  if (status === 401) return "Strava rejected the connection. Connect again.";
  if (status === 429) return "Strava is rate-limiting us. Try again in a few minutes.";
  return `Strava returned an error (${status}).`;
}

export interface FetchResult<T> {
  data: T | null;
  error: string | null;
  /** A refreshed session, when the token was renewed during the call. */
  session?: StravaSession;
}

async function authedGet<T>(path: string, session: StravaSession): Promise<FetchResult<T>> {
  const { session: fresh, error } = await validSession(session);
  if (!fresh) return { data: null, error };

  const get = (s: StravaSession) =>
    fetch(`https://www.strava.com/api/v3${path}`, { headers: { Authorization: `Bearer ${s.accessToken}` } });

  try {
    let current = fresh;
    let res = await get(current);

    // A 401 with a refresh token in hand is worth exactly one more try. The token may have
    // been revoked, or expired earlier than the expiry we stored; either way, giving up
    // without spending the refresh token turns a recoverable state into "connect again".
    if (res.status === 401 && current.refreshToken) {
      const renewed = await refreshSession(current);
      if (renewed.session) {
        current = renewed.session;
        res = await get(current);
      }
    }

    if (!res.ok) {
      // A 401 that survives a refresh is usually not an expiry at all — it is a token that
      // was never granted permission to read activities. Say so, because "connect again"
      // is advice that cannot work: approval_prompt=auto will reissue the same narrow token.
      const insufficient = res.status === 401 && !grantedActivityAccess(current);
      return {
        data: null,
        error: insufficient
          ? "Strava did not grant permission to read your activities. Reconnect and tick “View data about your activities”."
          : apiError(res.status),
        session: current,
      };
    }
    return { data: (await res.json()) as T, error: null, session: current };
  } catch {
    return { data: null, error: "Could not reach Strava.", session: fresh };
  }
}

export const fetchActivities = (
  session: StravaSession,
  perPage = 30,
): Promise<FetchResult<StravaActivitySummary[]>> =>
  authedGet<StravaActivitySummary[]>(`/athlete/activities?per_page=${perPage}`, session);

/**
 * The athlete's own heart-rate zones — the ones they see in the Strava app.
 *
 * Needs profile:read_all. A connection granted before that scope was requested will get a
 * 401 here, which grantedActivityAccess()'s sibling check surfaces as a prompt to reconnect
 * rather than as a wrong zone.
 */
export const fetchAthleteZones = (session: StravaSession): Promise<FetchResult<unknown>> =>
  authedGet<unknown>("/athlete/zones", session);

export const fetchActivity = (
  session: StravaSession,
  id: number,
): Promise<FetchResult<Record<string, unknown>>> =>
  authedGet<Record<string, unknown>>(`/activities/${id}`, session);

export const fetchStreams = (
  session: StravaSession,
  id: number,
): Promise<FetchResult<Record<string, { data: number[] }>>> =>
  authedGet<Record<string, { data: number[] }>>(
    `/activities/${id}/streams?keys=time,distance,altitude,heartrate,velocity_smooth,cadence,latlng&key_by_type=true`,
    session,
  );
