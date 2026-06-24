import { describe, expect, it } from "vitest";
import { hasLineupChanges, lineupChangesSince } from "./lineupDiff";

describe("lineupChangesSince (R4.3 — new acts since last onboarding)", () => {
  it("reports newly added acts not present at the last review", () => {
    const changes = lineupChangesSince({
      seenActKeys: ["a", "b", "c"],
      currentActKeys: ["a", "b", "c", "d", "e"],
      favoriteKeys: ["a"],
    });
    expect(changes.addedActKeys).toEqual(["d", "e"]);
    expect(changes.removedFavoriteKeys).toEqual([]);
    expect(hasLineupChanges(changes)).toBe(true);
  });

  it("flags favorites whose act was pulled from the lineup (never silently dropped)", () => {
    const changes = lineupChangesSince({
      seenActKeys: ["a", "b", "c"],
      currentActKeys: ["a", "c"], // "b" was removed
      favoriteKeys: ["a", "b"], // the user had favorited "b"
    });
    expect(changes.removedFavoriteKeys).toEqual(["b"]);
    expect(changes.addedActKeys).toEqual([]);
    expect(hasLineupChanges(changes)).toBe(true);
  });

  it("reports both additions and removals together", () => {
    const changes = lineupChangesSince({
      seenActKeys: ["a", "b"],
      currentActKeys: ["a", "x"], // b pulled, x added
      favoriteKeys: ["b"],
    });
    expect(changes.addedActKeys).toEqual(["x"]);
    expect(changes.removedFavoriteKeys).toEqual(["b"]);
  });

  it("no changes → empty + hasLineupChanges false", () => {
    const changes = lineupChangesSince({
      seenActKeys: ["a", "b", "c"],
      currentActKeys: ["c", "b", "a"], // same set, different order
      favoriteKeys: ["a", "b"],
    });
    expect(changes.addedActKeys).toEqual([]);
    expect(changes.removedFavoriteKeys).toEqual([]);
    expect(hasLineupChanges(changes)).toBe(false);
  });

  it("a removed act the user never favorited does not flag a removed favorite", () => {
    const changes = lineupChangesSince({
      seenActKeys: ["a", "b", "c"],
      currentActKeys: ["a", "b"], // c removed but not favorited
      favoriteKeys: ["a"],
    });
    expect(changes.removedFavoriteKeys).toEqual([]);
    expect(hasLineupChanges(changes)).toBe(false);
  });
});
