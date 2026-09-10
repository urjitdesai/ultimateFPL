import { describe, expect, it } from "vitest";
import {
  clearPendingLeagueInvite,
  destinationAfterAuthentication,
  getPendingLeagueInvite,
  getOrCreateLeagueInviteRequest,
  isValidLeagueInviteCode,
  leagueInviteMessage,
  leagueInvitePath,
  leagueInviteUrl,
  normalizeLeagueInviteCode,
  savePendingLeagueInvite,
} from "./league-invite";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("league invite links", () => {
  it("normalizes codes and builds a direct join URL", () => {
    expect(normalizeLeagueInviteCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(isValidLeagueInviteCode("ABCD2345")).toBe(true);
    expect(isValidLeagueInviteCode("SHORT")).toBe(false);
    expect(leagueInvitePath("abcd2345")).toBe("/join/ABCD2345");
    expect(leagueInviteUrl("abcd2345", "https://example.com")).toBe("https://example.com/join/ABCD2345");
  });

  it("creates a ready-to-share message with the league name, link, and code", () => {
    const message = leagueInviteMessage("Friday Rivals", "abcd2345", "https://example.com");
    expect(message).toContain("Friday Rivals");
    expect(message).toContain("https://example.com/join/ABCD2345");
    expect(message).toContain("League code: ABCD2345");
    expect(message).not.toContain("does not expire");
  });

  it("keeps an invite through authentication and clears it after joining", () => {
    const storage = memoryStorage();
    expect(savePendingLeagueInvite("abcd-2345", storage)).toBe("ABCD2345");
    expect(getPendingLeagueInvite(storage)).toBe("ABCD2345");
    expect(destinationAfterAuthentication("/dashboard", storage)).toBe("/join/ABCD2345");
    clearPendingLeagueInvite(storage);
    expect(getPendingLeagueInvite(storage)).toBeNull();
    expect(destinationAfterAuthentication("/dashboard", storage)).toBe("/dashboard");
  });

  it("reuses an in-flight join request until the user retries", () => {
    let requestCount = 0;
    const createRequest = () => {
      requestCount += 1;
      return Promise.resolve({ id: `league-${requestCount}` });
    };

    const first = getOrCreateLeagueInviteRequest(null, "user-1:ABCD2345:0", createRequest);
    const restartedEffect = getOrCreateLeagueInviteRequest(first, "user-1:ABCD2345:0", createRequest);
    const retry = getOrCreateLeagueInviteRequest(restartedEffect, "user-1:ABCD2345:1", createRequest);

    expect(restartedEffect).toBe(first);
    expect(retry).not.toBe(first);
    expect(requestCount).toBe(2);
  });
});
