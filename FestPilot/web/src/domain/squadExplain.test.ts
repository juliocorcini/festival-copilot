// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSquadPlan, type SquadMember } from "./squadPlan";
import { explainSquadBlock } from "./squadExplain";
import type { PlannableSet } from "./types";

const MIN = 60_000;
function set(id: string, startMin: number, endMin: number, actKey = id, stage = "S"): PlannableSet {
  return { id, actKey, label: id, stageId: stage, stageName: stage, startMs: startMin * MIN, endMs: endMin * MIN, day: "SAT", weekendId: "W1" };
}
function member(
  userId: string,
  role: "owner" | "member",
  picks: string[],
  opts: { isYou?: boolean; name?: string | null; fav?: string[] } = {}
): SquadMember {
  return {
    userId,
    displayName: opts.name === undefined ? userId : opts.name,
    avatarColor: null,
    role,
    isYou: opts.isYou ?? false,
    shared: true,
    performanceIds: picks,
    favoriteActKeys: opts.fav ?? [],
  };
}

describe("explainSquadBlock", () => {
  it("names who locked the winner (going) and who favorited the act, with the rule", () => {
    const sets = [set("A", 0, 60), set("B", 0, 60)];
    const members = [
      member("o", "owner", ["A"], { name: "Owner" }),
      member("a", "member", ["A"], { name: "Ana", fav: ["A"] }),
      member("b", "member", ["A"], { name: "Bob" }),
      member("c", "member", ["B"], { name: "Cara", fav: ["A"] }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    const ex = explainSquadBlock(plan.blocks[0]!, plan.members);

    expect(ex.method).toBe("plurality");
    expect(ex.winnerLabel).toBe("A");
    expect(ex.goingCount).toBe(3);
    expect(ex.goingNames).toEqual(["Owner", "Ana", "Bob"]);
    // Cara never locked A but favorited it, so she is a favoriter (derived), not a goer.
    expect(ex.favoritedNames.sort()).toEqual(["Ana", "Cara"]);
    expect(ex.favCount).toBe(2);
    expect(ex.memberCount).toBe(4);
    expect(ex.splits).toHaveLength(1);
    expect(ex.splits[0]).toMatchObject({ label: "B", names: ["Cara"] });
  });

  it("reports the favorited rule when a tie was broken by favorites", () => {
    const sets = [set("A", 0, 60), set("B", 0, 60)];
    // 1 lock each (tie); B is favorited by 2 → favorited wins.
    const members = [
      member("a", "member", ["A"], { fav: ["B"] }),
      member("b", "member", ["B"], { fav: ["B"] }),
      member("o", "owner", [], { fav: ["B"] }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    const block = plan.blocks[0]!;
    expect(block.set.id).toBe("B");
    const ex = explainSquadBlock(block, plan.members);
    expect(ex.method).toBe("favorited");
    expect(ex.favCount).toBe(3);
  });

  it("reports an owner override as a pinned owner pick", () => {
    const sets = [set("A", 0, 60), set("B", 0, 60)];
    const members = [member("o", "owner", ["A"]), member("a", "member", ["A"]), member("b", "member", ["B"])];
    const plan = buildSquadPlan({ sets, members, overrides: ["B"], meId: null });
    const block = plan.blocks[0]!;
    expect(block.set.id).toBe("B");
    const ex = explainSquadBlock(block, plan.members);
    expect(ex.method).toBe("owner");
    expect(ex.pinned).toBe(true);
  });

  it("does not recompute the winner — it mirrors the baseline block (invariance)", () => {
    const sets = [set("A", 0, 60), set("B", 0, 60)];
    const members = [member("a", "member", ["A"]), member("b", "member", ["A"]), member("c", "member", ["B"])];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    const block = plan.blocks[0]!;
    const ex = explainSquadBlock(block, plan.members);
    expect(ex.winnerLabel).toBe(block.set.label);
    expect(ex.stageName).toBe(block.set.stageName);
    expect(ex.goingCount).toBe(block.goingCount);
  });

  it("tolerates members with no display name yet (guests)", () => {
    const sets = [set("A", 0, 60)];
    const members = [member("a", "member", ["A"], { name: null }), member("b", "member", ["A"], { name: "Bo" })];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    const ex = explainSquadBlock(plan.blocks[0]!, plan.members);
    expect(ex.goingNames).toEqual([null, "Bo"]);
  });
});
