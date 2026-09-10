import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOAuthParams,
  completeSignIn,
  loadSession,
  needsRefresh,
  refreshSession,
  type StravaSession,
  saveSession,
  validSession,
} from "../../src/data/strava";

/**
 * §7.2. The behaviour that matters: sign in once, refresh silently, and never lose the
 * user's session to a six-hour timer.
 */

const session = (over: Partial<StravaSession> = {}): StravaSession => ({
  accessToken: "at",
  refreshToken: "rt",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  connected: true,
  ...over,
});

// A minimal localStorage, since these run in Node.
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

describe("session storage", () => {
  it("round-trips a session", () => {
    saveSession(session({ athleteName: "George" }));
    expect(loadSession()?.athleteName).toBe("George");
    expect(loadSession()?.refreshToken).toBe("rt");
  });

  it("clears on null", () => {
    saveSession(session());
    saveSession(null);
    expect(loadSession()).toBeNull();
  });

  it("migrates the legacy pasted-token shape", () => {
    // The old app stored a bare `token` with no refresh token.
    localStorage.setItem("stride.strava", JSON.stringify({ token: "old-token", connected: true }));
    const loaded = loadSession();
    expect(loaded?.accessToken).toBe("old-token");
    expect(loaded?.refreshToken).toBe("");
  });

  it("returns null for junk rather than throwing", () => {
    localStorage.setItem("stride.strava", "not json");
    expect(loadSession()).toBeNull();
  });
});

describe("needsRefresh", () => {
  it("refreshes inside the five-minute margin, not before", () => {
    const now = 1_000_000;
    expect(needsRefresh(session({ expiresAt: now + 600 }), now)).toBe(false);
    expect(needsRefresh(session({ expiresAt: now + 120 }), now)).toBe(true);
    expect(needsRefresh(session({ expiresAt: now - 10 }), now)).toBe(true);
  });

  // The fixture now matches the name: a legacy pasted token has no refresh token, which is
  // the reason not to refresh it. It previously carried the default refresh token, so it was
  // really asserting that *any* session with an unknown expiry never refreshes — which left
  // real sessions stuck on a stale access token. See stravaScope.test.ts.
  it("does not try to refresh a legacy token with no expiry", () => {
    expect(needsRefresh(session({ expiresAt: 0, refreshToken: "" }), 1_000_000)).toBe(false);
  });
});

describe("completeSignIn", () => {
  it("does nothing when there is no code in the URL", async () => {
    const result = await completeSignIn("?foo=bar");
    expect(result.session).toBeNull();
    expect(result.error).toBeNull();
  });

  it("reports a cancelled sign-in", async () => {
    const result = await completeSignIn("?error=access_denied");
    expect(result.error).toContain("cancelled");
  });

  it("exchanges a code and stores the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: "new-at",
              refresh_token: "new-rt",
              expires_at: 1_700_000_000,
              athlete: { firstname: "George", id: 42 },
            }),
            { status: 200 },
          ),
      ),
    );

    const result = await completeSignIn("?code=abc123");
    expect(result.error).toBeNull();
    expect(result.session?.accessToken).toBe("new-at");
    expect(result.session?.athleteName).toBe("George");
    // ...and it persisted, so a reload stays signed in.
    expect(loadSession()?.refreshToken).toBe("new-rt");
  });

  it("explains a callback-domain mismatch, which is the usual cause", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "strava_rejected" }), { status: 400 })),
    );
    const result = await completeSignIn("?code=abc123");
    expect(result.session).toBeNull();
    expect(result.error).toContain("callback domain");
  });

  it("passes Strava's own message through when it gives one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Bad Request" }), { status: 400 })),
    );
    expect((await completeSignIn("?code=x")).error).toContain("Bad Request");
  });

  it("survives the service being unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect((await completeSignIn("?code=x")).error).toContain("Could not reach");
  });
});

describe("refreshSession", () => {
  it("renews the token and keeps the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ access_token: "at2", refresh_token: "rt2", expires_at: 1_800_000_000 }),
            { status: 200 },
          ),
      ),
    );
    const result = await refreshSession(session({ athleteName: "George" }));
    expect(result.session?.accessToken).toBe("at2");
    // The athlete details survive a refresh.
    expect(result.session?.athleteName).toBe("George");
    expect(loadSession()?.accessToken).toBe("at2");
  });

  it("keeps the old refresh token when Strava does not rotate it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ access_token: "at2", expires_at: 1 }), { status: 200 }),
      ),
    );
    expect((await refreshSession(session())).session?.refreshToken).toBe("rt");
  });

  it("tells a legacy pasted token to reconnect, since there is nothing to refresh with", async () => {
    const result = await refreshSession(session({ refreshToken: "" }));
    expect(result.session).toBeNull();
    expect(result.error).toContain("Connect Strava again");
  });
});

describe("validSession", () => {
  it("passes a healthy session straight through, with no network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const s = session({ expiresAt: Math.floor(Date.now() / 1000) + 3600 });
    expect((await validSession(s)).session).toBe(s);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshes one that is about to expire", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ access_token: "at3", expires_at: 9 }), { status: 200 }),
      ),
    );
    const s = session({ expiresAt: Math.floor(Date.now() / 1000) + 30 });
    expect((await validSession(s)).session?.accessToken).toBe("at3");
  });
});

describe("clearOAuthParams", () => {
  it("removes the OAuth parameters so a refresh does not re-exchange the code", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { href: "https://example.com/app?code=abc&scope=read&keep=1" },
      history: { replaceState },
    });
    clearOAuthParams();
    const url = replaceState.mock.calls[0]?.[2] as string;
    expect(url).not.toContain("code=");
    expect(url).not.toContain("scope=");
    expect(url).toContain("keep=1");
  });
});
