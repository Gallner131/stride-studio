import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authorizeUrl,
  completeSignIn,
  fetchActivities,
  grantedActivityAccess,
  loadSession,
  needsRefresh,
  type StravaConfig,
  type StravaSession,
  saveSession,
} from "../../src/data/strava";

/**
 * §7.2, the reconnect loop.
 *
 * Reported as "Strava rejected the connection" straight after pressing Connect Strava, on
 * production, with a client id and callback domain that were verified correct.
 *
 * The cause is that Strava returns the *granted* scope in the callback query, and we threw
 * it away unread (clearOAuthParams deleted it). If the "View data about your activities"
 * permission was ever left unticked, every later connect used approval_prompt=auto, which
 * makes Strava skip the consent screen entirely and reissue a token with the same narrow
 * scope. The activities call then 401s, and pressing Connect again can never fix it —
 * there is no way to be asked the question a second time.
 */

const session = (over: Partial<StravaSession> = {}): StravaSession => ({
  accessToken: "at",
  refreshToken: "rt",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  connected: true,
  ...over,
});

const config: StravaConfig = { configured: true, clientId: "276637", scope: "read,activity:read_all" };

beforeEach(() => {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
  vi.restoreAllMocks();
});

describe("granted scope", () => {
  it("is recorded from the callback, not discarded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ access_token: "at", refresh_token: "rt", expires_at: 1_700_000_000 }),
            { status: 200 },
          ),
      ),
    );

    const result = await completeSignIn("?code=abc&scope=read,activity:read_all");
    expect(result.session?.scope).toBe("read,activity:read_all");
    expect(loadSession()?.scope).toBe("read,activity:read_all");
  });

  it("recognises a connection that can read activities", () => {
    expect(grantedActivityAccess(session({ scope: "read,activity:read_all" }))).toBe(true);
    expect(grantedActivityAccess(session({ scope: "read,activity:read" }))).toBe(true);
  });

  it("recognises one that cannot — the case that caused the loop", () => {
    expect(grantedActivityAccess(session({ scope: "read" }))).toBe(false);
    expect(grantedActivityAccess(session({ scope: "read,profile:read_all" }))).toBe(false);
  });

  // A session stored before this was recorded has no scope. Assume it is fine rather than
  // nagging everyone who is already connected and working.
  it("assumes an older session is fine when no scope was recorded", () => {
    expect(grantedActivityAccess(session())).toBe(true);
  });
});

describe("authorizeUrl", () => {
  it("lets Strava skip the consent screen on an ordinary connect", () => {
    expect(new URL(authorizeUrl(config, "https://app.example/")).searchParams.get("approval_prompt")).toBe(
      "auto",
    );
  });

  // Without this the user can never be re-asked for the permission they declined.
  it("forces the consent screen when re-asking for permission", () => {
    const url = new URL(authorizeUrl(config, "https://app.example/", { force: true }));
    expect(url.searchParams.get("approval_prompt")).toBe("force");
    expect(url.searchParams.get("scope")).toBe("read,activity:read_all");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/");
  });
});

describe("needsRefresh with an unknown expiry", () => {
  // Deliberate for a legacy pasted token: there is no refresh token, so there is nothing to
  // refresh with and it is honoured until it fails. Kept.
  it("still does not try to refresh a legacy token with no expiry", () => {
    expect(needsRefresh(session({ expiresAt: 0, refreshToken: "" }))).toBe(false);
  });

  // But a real session with a refresh token and an unknown expiry must refresh, or it is
  // stuck on a stale access token forever. refreshSession writes expiresAt: 0 itself
  // whenever Strava's response omits expires_at, so this state is reachable in normal use.
  it("refreshes a real session whose expiry was never recorded", () => {
    expect(needsRefresh(session({ expiresAt: 0 }))).toBe(true);
  });
});

describe("a 401 mid-session", () => {
  it("refreshes once and retries, rather than giving up", async () => {
    saveSession(session({ expiresAt: Math.floor(Date.now() / 1000) + 3600 }));
    const calls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/api/strava/refresh")) {
          return new Response(
            JSON.stringify({ access_token: "fresh-at", refresh_token: "rt", expires_at: 1_900_000_000 }),
            { status: 200 },
          );
        }
        // The first activities call fails; the one after the refresh succeeds.
        const already = calls.filter((c) => c.includes("/athlete/activities")).length;
        return already > 1
          ? new Response(JSON.stringify([{ id: 1, name: "Run" }]), { status: 200 })
          : new Response("", { status: 401 });
      }),
    );

    const result = await fetchActivities(session());
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(calls.some((c) => c.includes("/api/strava/refresh"))).toBe(true);
  });

  it("gives up honestly when the retry also fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/strava/refresh")) {
          return new Response(
            JSON.stringify({ access_token: "fresh-at", refresh_token: "rt", expires_at: 1_900_000_000 }),
            { status: 200 },
          );
        }
        return new Response("", { status: 401 });
      }),
    );

    const result = await fetchActivities(session());
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/permission|connect/i);
  });
});
