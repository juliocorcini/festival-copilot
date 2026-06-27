import { test, expect } from "./fixtures.js";
const API = "https://festpilot.trippilot.workers.dev";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

let FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD"; // live id; refreshed in beforeAll

/** A valid 26-char Crockford ULID for a throwaway anon bearer token. */
function ulid() {
  const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let s = "";
  for (let i = 0; i < 26; i++) s += ENC[Math.floor(Math.random() * 32)];
  return s;
}

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${API}/api/festivals`);
    const data = await res.json();
    if (data.festivals?.[0]?.id) FESTIVAL_ID = data.festivals[0].id;
  } catch {
    /* keep the hardcoded id */
  }
});

/** Init script (runs in the browser): seed completed onboarding so the app shell renders. */
const SEED_ONBOARDING = (arg) => {
  localStorage.setItem(
    "fp.store.v1",
    JSON.stringify({
      v: 1,
      onboarding: { festivalId: arg.festivalId, weekendIds: [arg.w1], dayKeys: [], completed: true },
      favorites: {},
      plans: {},
    })
  );
};

test.describe("Phase 4 — squad (Gate 4.1 identity + Gate 4.2 groups)", () => {
  test("owner: empty → sign in → profile → create → invite → group home", async ({ page }) => {
    await page.addInitScript(SEED_ONBOARDING, { festivalId: FESTIVAL_ID, w1: W1 });
    await page.goto("/squad");
    // 1 · empty hero
    await expect(
      page.getByRole("heading", { name: "Festivals are better together" })
    ).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-squad-empty.png" });
    await page.getByRole("button", { name: "Create a squad" }).click();

    // 2 · sign-in gate (guest)
    await expect(page.getByRole("heading", { name: "Keep your squad across devices" })).toBeVisible();
    await page.getByRole("button", { name: /Continue as guest/ }).click();

    // 3 · profile
    await expect(page.getByRole("heading", { name: "How should the squad see you?" })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator("#display-name").fill("Julio");
    await page.getByRole("button", { name: "Color #0EA5E9" }).click();
    await page.screenshot({ path: "e2e/screenshots/phase4-profile.png" });
    await page.getByRole("button", { name: "Continue" }).click();

    // 4 · create squad
    await expect(page.getByRole("heading", { name: "Create your squad" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Choose squad emoji" }).click();
    await page.getByRole("button", { name: "Emoji 🔥" }).click();
    await page.locator("#squad-name").fill("FAM JUNTOS");
    await page.screenshot({ path: "e2e/screenshots/phase4-create.png" });
    await page.getByRole("button", { name: "Create squad" }).click();

    // 5 · invite — QR + link
    await expect(page.getByRole("heading", { name: "Bring the squad in" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("img", { name: /QR code to join/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/\/j\//)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-invite.png" });
    await page.getByRole("button", { name: "Done" }).click();

    // 6 · group home — header + member list (you = owner)
    await expect(page.getByText(/FAM JUNTOS · 1 person/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Julio", { exact: false })).toBeVisible();
    await expect(page.getByText("Owner")).toBeVisible();
    await expect(page.getByRole("button", { name: /Leave squad/ })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-group-home.png" });

    // D20/D21 — the reorganized home leads with the squad "Next up" card (above the plan CTA + Where).
    await expect(page.getByText("Next up", { exact: true })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/g9-squad-nextup.png" });

    // D24 — the Home gains a "My plan / Squad" toggle for a squad user; the Squad tab surfaces Next up.
    await page.locator(".nav").getByRole("link", { name: "Now" }).click();
    const squadTab = page.getByRole("tab", { name: "Squad" });
    await expect(squadTab).toBeVisible({ timeout: 20_000 });
    await squadTab.click();
    await expect(page.getByText("Next up", { exact: true })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/g9-now-squad-tab.png" });
    await page.getByRole("tab", { name: "My plan" }).click();
  });

  test("joiner: open invite link → guest → join → members(2)", async ({ page, request }) => {
    // Owner + squad created server-side to get a real invite token quickly.
    const ownerTok = `anon.${ulid()}`;
    await request.put(`${API}/api/me`, {
      headers: { authorization: `Bearer ${ownerTok}` },
      data: { displayName: "Andy", avatarColor: "#0EA5E9" },
    });
    const created = await request.post(`${API}/api/groups`, {
      headers: { authorization: `Bearer ${ownerTok}` },
      data: { name: "FAM JUNTOS", emoji: "🔥", festivalId: FESTIVAL_ID },
    });
    const token = (await created.json()).group.inviteToken;
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);

    await page.addInitScript(SEED_ONBOARDING, { festivalId: FESTIVAL_ID, w1: W1 });
    await page.goto(`/j/${token}`);
    // Guest is gated through sign-in → profile (carrying the join path).
    await expect(page.getByRole("heading", { name: "Keep your squad across devices" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Continue as guest/ }).click();
    await expect(page.getByRole("heading", { name: "How should the squad see you?" })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator("#display-name").fill("Julio");
    await page.getByRole("button", { name: "Continue" }).click();

    // Back on the invite preview — owner + squad name + join-as.
    await expect(page.getByRole("heading", { name: /FAM JUNTOS/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/invited you to join/)).toBeVisible();
    await expect(page.getByText(/You'll join as/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-join.png" });
    await page.getByRole("button", { name: "Join squad" }).click();

    // Auto-share confirm on join (R9.4, DEC-054): the share screen appears (toggles default ON);
    // a guest with no plan yet taps "Not now" to continue to the group home.
    await expect(page.locator(".share-intro h1")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Not now" }).click();

    // Group home now shows two people.
    await expect(page.getByText(/FAM JUNTOS · 2 people/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Andy", { exact: false })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase4-group-home-2.png" });
  });
});
