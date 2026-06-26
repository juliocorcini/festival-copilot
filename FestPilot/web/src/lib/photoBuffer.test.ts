import { describe, expect, it } from "vitest";
import { BUFFER_AHEAD, prefetchWindow } from "./photoBuffer";

// A 9-item list with photoless artists (null) interleaved at indices 1 and 4. Seven have photos.
const urls = ["a", null, "b", "c", null, "d", "e", "f", "g"];

describe("prefetchWindow (DEC-067 / IMG-2)", () => {
  it("returns the first 5 photo URLs from index 0, skipping the null at index 1 and 4", () => {
    expect(prefetchWindow(urls, 0, 5)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("defaults to BUFFER_AHEAD (5) when no size is given", () => {
    expect(BUFFER_AHEAD).toBe(5);
    expect(prefetchWindow(urls, 0)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("returns fewer than `size` near the end of the list (only what remains)", () => {
    // From index 5: "d","e","f","g" — 4 photos left, so 4 returned even though size is 5.
    expect(prefetchWindow(urls, 5, 5)).toEqual(["d", "e", "f", "g"]);
  });

  it("starts at the given index and never emits a photoless (null) entry", () => {
    // index 1 is null → skipped; window of 3 from there is b,c,d.
    const out = prefetchWindow(urls, 1, 3);
    expect(out).toEqual(["b", "c", "d"]);
    expect(out.some((u) => !u)).toBe(false);
  });

  it("collapses duplicate URLs so the same photo is never requested twice", () => {
    expect(prefetchWindow(["x", "y", "x", "z"], 0, 5)).toEqual(["x", "y", "z"]);
  });

  it("clamps a negative index to 0 and an out-of-range index to an empty window", () => {
    expect(prefetchWindow(urls, -3, 2)).toEqual(["a", "b"]);
    expect(prefetchWindow(urls, 99, 5)).toEqual([]);
  });
});
