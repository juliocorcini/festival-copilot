import { describe, expect, it } from "vitest";
import { resolveOnboardingNext, safeNext, withAutoJoin } from "./onboardingRedirect";

describe("safeNext (open-redirect guard)", () => {
  it("accepts same-origin app paths", () => {
    expect(safeNext("/j/AB12CD")).toBe("/j/AB12CD");
    expect(safeNext("/squad/join/AB12CD")).toBe("/squad/join/AB12CD");
    expect(safeNext("/plan?day=fri")).toBe("/plan?day=fri");
  });

  it("rejects empty, protocol-relative and absolute URLs", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
  });
});

describe("withAutoJoin (invite paths only)", () => {
  it("flags invite paths so the user auto-joins after onboarding", () => {
    expect(withAutoJoin("/j/AB12CD")).toBe("/j/AB12CD?auto=1");
    expect(withAutoJoin("/squad/join/AB12CD")).toBe("/squad/join/AB12CD?auto=1");
  });

  it("merges with an existing query string", () => {
    expect(withAutoJoin("/j/AB12CD?ref=x")).toBe("/j/AB12CD?ref=x&auto=1");
  });

  it("leaves non-invite paths untouched", () => {
    expect(withAutoJoin("/plan")).toBe("/plan");
    expect(withAutoJoin("/squad")).toBe("/squad");
  });
});

describe("resolveOnboardingNext (end to end)", () => {
  it("auto-joins a captured invite link", () => {
    expect(resolveOnboardingNext("/j/AB12CD")).toBe("/j/AB12CD?auto=1");
  });

  it("falls back to home for missing or unsafe targets", () => {
    expect(resolveOnboardingNext(null)).toBe("/");
    expect(resolveOnboardingNext("//evil.com")).toBe("/");
  });

  it("honours a safe non-invite deep link without an auto flag", () => {
    expect(resolveOnboardingNext("/plan?day=fri")).toBe("/plan?day=fri");
  });
});
