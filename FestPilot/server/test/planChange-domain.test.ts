import { describe, expect, it } from "vitest";
import { diffShareIds, shouldCoalesce, PLAN_CHANGE_COALESCE_MS } from "../src/domain/planChange";

describe("planChange.diffShareIds — content diff (idempotency gate)", () => {
  it("counts added and removed against the previous picks", () => {
    const d = diffShareIds(["a", "b", "c"], ["b", "c", "d", "e"]);
    expect(d.added).toBe(2); // d, e
    expect(d.removed).toBe(1); // a
    expect(d.changed).toBe(true);
  });

  it("is a no-op when the picks are identical (order-independent) — no revision bump", () => {
    const d = diffShareIds(["a", "b", "c"], ["c", "a", "b"]);
    expect(d).toEqual({ added: 0, removed: 0, changed: false });
  });

  it("treats duplicates as the same id (set semantics)", () => {
    const d = diffShareIds(["a", "a"], ["a"]);
    expect(d).toEqual({ added: 0, removed: 0, changed: false });
  });

  it("first share (empty → some) adds every pick", () => {
    expect(diffShareIds([], ["a", "b"])).toEqual({ added: 2, removed: 0, changed: true });
  });

  it("clearing every pick removes them all", () => {
    expect(diffShareIds(["a", "b"], [])).toEqual({ added: 0, removed: 2, changed: true });
  });
});

describe("planChange.shouldCoalesce — anti-spam window", () => {
  const t0 = Date.parse("2026-06-27T20:00:00Z");

  it("coalesces a change inside the window", () => {
    expect(shouldCoalesce(t0, t0 + 30_000)).toBe(true);
    expect(shouldCoalesce(t0, t0 + PLAN_CHANGE_COALESCE_MS)).toBe(true);
  });

  it("opens a new line once the window has passed", () => {
    expect(shouldCoalesce(t0, t0 + PLAN_CHANGE_COALESCE_MS + 1)).toBe(false);
  });

  it("never coalesces on a negative gap (clock skew) or NaN", () => {
    expect(shouldCoalesce(t0, t0 - 1_000)).toBe(false);
    expect(shouldCoalesce(Number.NaN, t0)).toBe(false);
  });
});
