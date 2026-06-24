import { test, expect } from "@playwright/test";

/**
 * Gate 4.3 — shared timetable. Drives the real flow against the live Worker:
 * share my locked plan (#23.8) → squad plan overview (#24.1) → block detail (#24.2)
 * → owner override (#24.4). Server state is seeded over the API with real performance ids
 * (so the client's lineup-based aggregation actually resolves the blocks).
 */

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const API = "https://festpilot.trippilot.workers.dev";

let FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
/** The earliest real, timed performance — its day is days[0] so the overview defaults to it. */
let PICK = null;

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
    .filter((p) => !p.isPlaceholder && p.startAtUtc && p.endAtUtc && p.day && p.weekendId)
    .sort((a, b) => Date.parse(a.startAtUtc) - Date.parse(b.startAtUtc));
  const p = timed[0];
  PICK = {
    perfId: p.id,
    day: p.day,
    weekendId: p.weekendId,
    label: p.name || p.artists?.[0]?.name || "TBA",
    stageName: (p.stageId && stageName.get(p.stageId)) || "—",
    startMs: Date.parse(p.startAtUtc),
    endMs: Date.parse(p.endAtUtc),
  };
});

async function makeUser(request, name, color = "#0EA5E9") {
  const tok = `anon.${ulid()}`;
  const r = await request.put(`${API}/api/me`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { displayName: name, avatarColor: color },
  });
  const user = (await r.json()).user ?? { displayName: name, avatarColor: color };
  return { tok, user };
}

async function createGroup(request, tok, name = "PLAN SQUAD", emoji = "🔥") {
  const r = await request.post(`${API}/api/groups`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { name, emoji, festivalId: FESTIVAL_ID },
  });
  return (await r.json()).group;
}

async function joinSquad(request, tok, token) {
  await request.post(`${API}/api/groups/join`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { token },
  });
}

async function shareplan(request, tok, groupId, day, perfId) {
  await request.put(`${API}/api/groups/${groupId}/plan`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { day, slots: [{ performanceId: perfId }], shareFavorites: false, favoriteActKeys: [] },
  });
}

/** Seed the browser as a known anon user with completed onboarding + optional locked plan. */
const SEED = (arg) => {
  localStorage.setItem("fp.auth.v1", JSON.stringify({ token: arg.token, user: arg.user }));
  localStorage.setItem(
    "fp.store.v1",
    JSON.stringify({
      v: 1,
      onboarding: { festivalId: arg.festivalId, weekendIds: [arg.weekendId], dayKeys: [], completed: true },
      favorites: {},
      plans: arg.plan ? { [`${arg.festivalId}:${arg.day}`]: { slots: arg.plan, lockedAt: Date.now() } } : {},
    })
  );
};

test.describe("Gate 4.3 — shared timetable", () => {
  test("owner shares locked plan (#23.8) → squad plan overview (#24.1)", async ({ page, request }) => {
    const owner = await makeUser(request, "Julio");
    const group = await createGroup(request, owner.tok);

    const slot = [
      {
        setId: PICK.perfId,
        actKey: "seed",
        label: PICK.label,
        stageId: null,
        stageName: PICK.stageName,
        startMs: PICK.startMs,
        endMs: PICK.endMs,
        cutMs: null,
        day: PICK.day,
      },
    ];
    await page.addInitScript(SEED, {
      token: owner.tok,
      user: owner.user,
      festivalId: FESTIVAL_ID,
      weekendId: PICK.weekendId,
      day: PICK.day,
      plan: slot,
    });

    await page.goto(`/squad/${group.id}/share`);
    await page.addStyleTag({ content: FREEZE });

    // Share screen — intro + my locked plan preview row.
    await expect(page.getByRole("heading", { name: /Share your plan/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Share my locked plan")).toBeVisible();
    await expect(page.getByText(PICK.label, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-share.png" });

    await page.getByRole("button", { name: "Share with squad" }).click();

    // Overview — header + the block built from my pick.
    await expect(page.getByRole("heading", { name: "Squad plan" })).toBeVisible({ timeout: 20_000 });
    await page.goto(`/squad/${group.id}/plan?day=${encodeURIComponent(PICK.day)}`);
    await expect(page.getByText(PICK.label, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-squad-plan.png" });
  });

  test("two members → overview → block detail (#24.2) → owner override (#24.4)", async ({ page, request }) => {
    const owner = await makeUser(request, "Julio");
    const group = await createGroup(request, owner.tok);
    const maya = await makeUser(request, "Maya", "#22C55E");
    await joinSquad(request, maya.tok, group.inviteToken);
    await shareplan(request, owner.tok, group.id, PICK.day, PICK.perfId);
    await shareplan(request, maya.tok, group.id, PICK.day, PICK.perfId);

    await page.addInitScript(SEED, {
      token: owner.tok,
      user: owner.user,
      festivalId: FESTIVAL_ID,
      weekendId: PICK.weekendId,
      day: PICK.day,
    });

    await page.goto(`/squad/${group.id}/plan?day=${encodeURIComponent(PICK.day)}`);
    await page.addStyleTag({ content: FREEZE });

    // Overview shows two people and the consensus block.
    await expect(page.getByText(/· 2 people/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(PICK.label, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-squad-plan-2.png" });

    // Block detail — squad pick + owner's override entry.
    await page.getByText(PICK.label, { exact: false }).first().click();
    await expect(page.getByText("Squad is going to")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Override squad pick/ })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-block.png" });

    // Owner override screen — candidate list + note.
    await page.getByRole("button", { name: /Override squad pick/ }).click();
    await expect(page.getByRole("heading", { name: "Set squad pick" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Overrides the auto pick/)).toBeVisible();
    await expect(page.getByText(PICK.label, { exact: false }).first()).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-override.png" });
  });
});
