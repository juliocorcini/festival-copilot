// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSquadPlan, stageEntriesForBlock, type SquadMember } from "./squadPlan";
import type { PlannableSet } from "./types";

const MIN = 60_000;
function set(id: string, startMin: number, endMin: number, actKey = id, stage = "S"): PlannableSet {
  return {
    id,
    actKey,
    label: id,
    stageId: stage,
    stageName: stage,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    day: "SAT",
    weekendId: "W1",
  };
}

function member(
  userId: string,
  role: "owner" | "member",
  picks: string[],
  opts: { isYou?: boolean; shared?: boolean; fav?: string[] } = {}
): SquadMember {
  return {
    userId,
    displayName: userId,
    avatarColor: null,
    role,
    isYou: opts.isYou ?? false,
    shared: opts.shared ?? true,
    performanceIds: picks,
    favoriteActKeys: opts.fav ?? [],
  };
}

describe("buildSquadPlan — plurality + split", () => {
  const sets = [set("A", 0, 60), set("B", 0, 60)];

  it("picks the most-locked set as the block winner and surfaces the rest as the split", () => {
    const members = [
      member("o", "owner", ["A"]),
      member("a", "member", ["A"]),
      member("b", "member", ["A"]),
      member("c", "member", ["B"]),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    expect(plan.blocks).toHaveLength(1);
    const block = plan.blocks[0]!;
    expect(block.set.id).toBe("A");
    expect(block.method).toBe("plurality");
    expect(block.goingCount).toBe(3);
    expect(block.splitCount).toBe(1);
    expect(block.split).toHaveLength(1);
    expect(block.split[0]!.set.id).toBe("B");
    expect(block.split[0]!.members.map((m) => m.userId)).toEqual(["c"]);
  });

  it("counts unshared members in the squad size but not in any pick", () => {
    const members = [
      member("o", "owner", ["A"]),
      member("a", "member", ["A"]),
      member("ghost", "member", [], { shared: false }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    expect(plan.memberCount).toBe(3);
    expect(plan.sharedCount).toBe(2);
    expect(plan.blocks[0]!.goingCount).toBe(2);
  });
});

describe("buildSquadPlan — your status (following / your own / conflict)", () => {
  // Block X (0–60): you + 3 lock A (4), 2 lock B → following. Block Y (120–180): you + 2 lock C (3),
  // 3 lock D → an even split, so "your own".
  const sets = [set("A", 0, 60), set("B", 0, 60), set("C", 120, 180), set("D", 120, 180)];
  const members = [
    member("me", "owner", ["A", "C"], { isYou: true }),
    member("a", "member", ["A", "C"]),
    member("b", "member", ["A", "C"]),
    member("c", "member", ["A", "D"]),
    member("d", "member", ["B", "D"]),
    member("e", "member", ["B", "D"]),
  ];

  it("flags 'following' when you locked the winner and you're with the bigger group", () => {
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "me" });
    const x = plan.blocks.find((bl) => bl.set.id === "A")!;
    expect(x.youStatus).toBe("following");
    expect(x.goingCount).toBe(4);
    expect(x.splitCount).toBe(2);
  });

  it("flags 'your own' when you locked the winner but the squad is evenly split", () => {
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "me" });
    const y = plan.blocks.find((bl) => bl.set.id === "C")!;
    expect(y.youStatus).toBe("own");
    expect(y.goingCount).toBe(3);
    expect(y.splitCount).toBe(3);
  });
});

describe("buildSquadPlan — never silently change a locked must-see (DEC-013)", () => {
  const sets = [set("A", 0, 60, "actA"), set("B", 0, 60, "actB")];

  it("keeps you on your locked set, marks conflict, and never rewrites your pick", () => {
    const members = [
      member("a", "owner", ["A"]),
      member("b", "member", ["A"]),
      member("c", "member", ["A"]),
      member("me", "member", ["B"], { isYou: true }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "me" });
    const block = plan.blocks[0]!;
    expect(block.set.id).toBe("A"); // squad pick is the plurality
    expect(block.youStatus).toBe("conflict");
    expect(block.yourLock!.id).toBe("B"); // your lock is untouched
  });
});

describe("buildSquadPlan — favorites tie-break (DEC-019)", () => {
  it("breaks a lock tie by how many members favorited the act", () => {
    const sets = [set("A", 0, 60, "actA"), set("B", 0, 60, "actB")];
    const members = [
      member("a", "owner", ["A"], { fav: ["actA"] }),
      member("b", "member", ["A"], { fav: ["actA"] }),
      member("c", "member", ["B"], { fav: ["actA"] }),
      member("d", "member", ["B"], { fav: ["actB"] }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: null });
    const block = plan.blocks[0]!;
    expect(block.set.id).toBe("A"); // 2–2 on locks, but actA is favorited 3× vs 1×
    expect(block.method).toBe("favorited");
  });
});

describe("buildSquadPlan — owner override (#24.4)", () => {
  it("pins the owner's choice as the winner even against the plurality, demoting it to the split", () => {
    const sets = [set("A", 0, 60), set("B", 0, 60)];
    const members = [
      member("o", "owner", ["A"]),
      member("a", "member", ["A"]),
      member("b", "member", ["A"]),
      member("d", "member", ["B"]),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: ["B"], meId: null });
    const block = plan.blocks[0]!;
    expect(block.set.id).toBe("B");
    expect(block.method).toBe("owner");
    expect(block.pinned).toBe(true);
    expect(block.split.find((g) => g.set.id === "A")!.members.map((m) => m.userId).sort()).toEqual([
      "a",
      "b",
      "o",
    ]);
  });
});

describe("buildSquadPlan — favorites fallback offer (DEC-019)", () => {
  it("offers your own favorite near the squad when you're in conflict", () => {
    // Squad goes to A; you locked B; you also ❤ C, where two friends are.
    const sets = [set("A", 0, 60, "actA"), set("B", 0, 60, "actB"), set("C", 0, 60, "actC")];
    const members = [
      member("a", "owner", ["A"]),
      member("b", "member", ["A"]),
      member("c", "member", ["A"]),
      member("me", "member", ["B"], { isYou: true }),
      member("d", "member", ["C"]),
      member("e", "member", ["C"]),
    ];
    const plan = buildSquadPlan({
      sets,
      members,
      overrides: [],
      meId: "me",
      myFavoriteActKeys: new Set(["actC"]),
    });
    const block = plan.blocks[0]!;
    expect(block.youStatus).toBe("conflict");
    expect(block.fallback).not.toBeNull();
    expect(block.fallback!.set.id).toBe("C");
    expect(block.fallback!.friendsThere).toBe(2);
  });

  it("offers no fallback when you have no overlapping favorite", () => {
    const sets = [set("A", 0, 60, "actA"), set("B", 0, 60, "actB")];
    const members = [
      member("a", "owner", ["A"]),
      member("b", "member", ["A"]),
      member("me", "member", ["B"], { isYou: true }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "me", myFavoriteActKeys: new Set(["actZ"]) });
    expect(plan.blocks[0]!.fallback).toBeNull();
  });
});

describe("buildSquadPlan — full night ordering + empty state", () => {
  it("produces conflict-free, chronological blocks across the night", () => {
    const sets = [
      set("sara", 1260, 1320, "sara", "CAGE"), // 21:00–22:00
      set("charlotte", 1320, 1380, "charlotte", "MAINSTAGE"), // 22:00–23:00
      set("artbat", 1410, 1500, "artbat", "CORE"), // 23:30–01:00
      set("adriatique", 1500, 1590, "adriatique", "FREEDOM"), // 01:00–02:30
    ];
    const members = [
      member("o", "owner", ["sara", "charlotte", "artbat", "adriatique"]),
      member("a", "member", ["sara", "charlotte", "artbat"]),
      member("b", "member", ["sara", "charlotte", "artbat"]),
      member("c", "member", ["sara", "artbat", "adriatique"]),
      member("d", "member", ["sara", "artbat"]),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "o" });
    expect(plan.blocks.map((bl) => bl.set.id)).toEqual(["sara", "charlotte", "artbat", "adriatique"]);
    for (let i = 1; i < plan.blocks.length; i++) {
      expect(plan.blocks[i]!.set.startMs).toBeGreaterThanOrEqual(plan.blocks[i - 1]!.set.endMs);
    }
    expect(plan.blocks.find((bl) => bl.set.id === "artbat")!.goingCount).toBe(5);
  });

  it("builds nothing when nobody has shared a usable plan", () => {
    const sets = [set("A", 0, 60)];
    const members = [member("o", "owner", [], { shared: false }), member("a", "member", [], { shared: false })];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "o" });
    expect(plan.blocks).toHaveLength(0);
    expect(plan.enoughToBuild).toBe(false);
    expect(plan.sharedCount).toBe(0);
    expect(plan.memberCount).toBe(2);
  });
});

describe("stageEntriesForBlock — rich split view (#24.5)", () => {
  const sets = [set("A", 0, 60, "actA", "MAINSTAGE"), set("B", 0, 60, "actB", "CORE"), set("C", 0, 60, "actC", "FREEDOM")];

  it("lists the winner first, then each split set by headcount, flagging the one with you", () => {
    const members = [
      member("o", "owner", ["A"]),
      member("a", "member", ["A"]),
      member("b", "member", ["A"]),
      member("c", "member", ["B"]),
      member("d", "member", ["B"]),
      member("me", "member", ["C"], { isYou: true }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "me" });
    const entries = stageEntriesForBlock(plan.blocks[0]!);

    expect(entries.map((e) => e.set.id)).toEqual(["A", "B", "C"]); // winner, then by size
    expect(entries[0]!.isWinner).toBe(true);
    expect(entries[0]!.members.map((m) => m.userId).sort()).toEqual(["a", "b", "o"]);
    expect(entries[1]!.members.map((m) => m.userId).sort()).toEqual(["c", "d"]);
    const yours = entries.find((e) => e.isYou)!;
    expect(yours.set.id).toBe("C");
    expect(yours.isWinner).toBe(false);
  });

  it("returns a single winner entry when the squad is together (no split)", () => {
    const members = [member("o", "owner", ["A"]), member("a", "member", ["A"]), member("b", "member", ["A"])];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "o" });
    const entries = stageEntriesForBlock(plan.blocks[0]!);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.isWinner).toBe(true);
    expect(entries[0]!.members).toHaveLength(3);
  });

  it("drops empty stages and never lists a member twice", () => {
    const members = [
      member("o", "owner", ["A"]),
      member("a", "member", ["A"]),
      member("me", "member", ["B"], { isYou: true }),
    ];
    const plan = buildSquadPlan({ sets, members, overrides: [], meId: "me" });
    const entries = stageEntriesForBlock(plan.blocks[0]!);
    const ids = entries.flatMap((e) => e.members.map((m) => m.userId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(entries.every((e) => e.members.length > 0)).toBe(true);
  });
});
