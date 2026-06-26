import { test, expect } from "./fixtures.js";

/**
 * Rich split view (#24.5). Seeds two squadmates onto two overlapping sets on different stages, so
 * the squad plan produces a contested block, then drives: squad plan → block detail → "See who's
 * where" → the per-stage split screen. Runs against the live Worker like the squad-plan gate.
 */const API = "https://festpilot.trippilot.workers.dev";

let FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
/** Two overlapping, different-stage timed sets on the same day (or null if the lineup has none). */
let PAIR = null;

function ulid() {
  const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let s = "";
  for (let i = 0; i < 26; i++) s += ENC[Math.floor(Math.random() * 32)];
  return s;
}

test.beforeAll(async ({ request }) => {
  try {
    const fres = await request.get(`${API}/api/festivals`);
    const fdata = await fres.json();
    if (fdata.festivals?.[0]?.id) FESTIVAL_ID = fdata.festivals[0].id;
  } catch {
    /* keep the hardcoded id */
  }
  const lres = await request.get(`${API}/api/festivals/${FESTIVAL_ID}/lineup`);
  const lineup = await lres.json();
  const stageName = new Map((lineup.stages ?? []).map((s) => [s.id, s.name]));
  const timed = (lineup.performances ?? [])
    .filter((p) => !p.isPlaceholder && p.startAtUtc && p.endAtUtc && p.day && p.weekendId && p.stageId)
    .map((p) => ({
      perfId: p.id,
      day: p.day,
      weekendId: p.weekendId,
      stageId: p.stageId,
      stageName: stageName.get(p.stageId) || "—",
      label: p.name || p.artists?.[0]?.name || "TBA",
      startMs: Date.parse(p.startAtUtc),
      endMs: Date.parse(p.endAtUtc),
    }))
    .sort((a, b) => a.startMs - b.startMs);

  outer: for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (b.startMs >= a.endMs) break; // sorted: nothing after b overlaps a either
      if (a.day === b.day && a.weekendId === b.weekendId && a.stageId !== b.stageId) {
        PAIR = { a, b, day: a.day, weekendId: a.weekendId };
        break outer;
      }
    }
  }
});

async function makeUser(request, name, color) {
  const tok = `anon.${ulid()}`;
  const r = await request.put(`${API}/api/me`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { displayName: name, avatarColor: color },
  });
  const user = (await r.json()).user ?? { displayName: name, avatarColor: color };
  return { tok, user };
}

async function createGroup(request, tok) {
  const r = await request.post(`${API}/api/groups`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { name: "SPLIT SQUAD", emoji: "🪩", festivalId: FESTIVAL_ID },
  });
  return (await r.json()).group;
}

async function joinSquad(request, tok, token) {
  await request.post(`${API}/api/groups/join`, { headers: { authorization: `Bearer ${tok}` }, data: { token } });
}

async function shareplan(request, tok, groupId, day, perfId) {
  await request.put(`${API}/api/groups/${groupId}/plan`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { day, slots: [{ performanceId: perfId }], shareFavorites: false, favoriteActKeys: [] },
  });
}

const SEED = (arg) => {
  localStorage.setItem("fp.auth.v1", JSON.stringify({ token: arg.token, user: arg.user }));
  localStorage.setItem(
    "fp.store.v1",
    JSON.stringify({
      v: 1,
      onboarding: { festivalId: arg.festivalId, weekendIds: [arg.weekendId], dayKeys: [], completed: true },
      favorites: {},
      plans: {},
    })
  );
};

test.describe("Rich split view (#24.5)", () => {
  test("two overlapping picks → block detail → 'See who's where' → per-stage split", async ({ page, request }) => {
    test.skip(!PAIR, "lineup has no two overlapping different-stage sets to build a split");

    const owner = await makeUser(request, "Julio", "#F5A623");
    const maya = await makeUser(request, "Maya", "#22C55E");
    const group = await createGroup(request, owner.tok);
    await joinSquad(request, maya.tok, group.inviteToken);
    // Owner is the tie-breaker, so PAIR.a (owner's pick) becomes the winner; PAIR.b is the split.
    await shareplan(request, owner.tok, group.id, PAIR.day, PAIR.a.perfId);
    await shareplan(request, maya.tok, group.id, PAIR.day, PAIR.b.perfId);

    await page.addInitScript(SEED, {
      token: owner.tok,
      user: owner.user,
      festivalId: FESTIVAL_ID,
      weekendId: PAIR.weekendId,
    });

    await page.goto(`/squad/${group.id}/plan?day=${encodeURIComponent(PAIR.day)}`);
    // Block shows the contested winner with a split count.
    await expect(page.getByText(PAIR.a.label, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(PAIR.a.label, { exact: false }).first().click();

    await expect(page.getByText("Squad is going to")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("The split")).toBeVisible();
    await page.getByRole("button", { name: /See who's where/ }).click();

    // Split screen — per-stage cards for the winner and the split, with "you" flagged.
    await expect(page.locator(".split-title")).toContainText("squad splits", { timeout: 20_000 });
    await expect(page.locator(".split-card")).toHaveCount(2);
    await expect(page.locator(".split-you").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Set a meet-up after/ })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-split.png" });
  });
});
