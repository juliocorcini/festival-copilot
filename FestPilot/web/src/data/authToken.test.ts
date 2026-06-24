import { beforeEach, describe, expect, it } from "vitest";
import { authHeader, cacheUser, cachedUser, getAuthToken, loadAuth } from "./authToken";
import { initialsOf } from "./identity";
import type { UserDto } from "./types";

beforeEach(() => localStorage.clear());

describe("auth token (anonymous-local, DEC-024/038)", () => {
  it("mints a well-formed anon token on first use and persists it", () => {
    const token = getAuthToken();
    expect(token).toMatch(/^anon\.[0-9A-HJKMNP-TV-Z]{26}$/i);
    expect(loadAuth()?.token).toBe(token);
  });

  it("is stable — the same token is returned on subsequent calls", () => {
    const a = getAuthToken();
    const b = getAuthToken();
    expect(b).toBe(a);
  });

  it("exposes a Bearer Authorization header", () => {
    const header = authHeader();
    expect(header.authorization).toBe(`Bearer ${getAuthToken()}`);
  });

  it("caches the user without dropping the token", () => {
    const token = getAuthToken();
    const user: UserDto = {
      id: "u1",
      displayName: "Julio",
      avatarUrl: null,
      avatarColor: "#F5A623",
      isAnonymous: true,
      provider: "anonymous",
    };
    cacheUser(user);
    expect(cachedUser()?.displayName).toBe("Julio");
    expect(loadAuth()?.token).toBe(token); // unchanged
  });
});

describe("initialsOf", () => {
  it("derives one- and two-word initials and a safe fallback", () => {
    expect(initialsOf("Julio")).toBe("JU");
    expect(initialsOf("Julio Corcini")).toBe("JC");
    expect(initialsOf("  ana  paula  silva ")).toBe("AS");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf("")).toBe("?");
  });
});
