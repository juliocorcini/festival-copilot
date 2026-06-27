import { test, expect } from "./fixtures.js";

/**
 * Phase 6 / Gate 6.1 — "come to me" meeting point (#26.1 pick-spot, #26.2 details, UC-27). Visual +
 * behaviour check of the create flow: squad home CTA → pick the spot on the real festival map →
 * details (name / when / who / note) → POST → the active point card lands on the squad home.
 *
 * The group + meeting-point endpoints are stubbed (a deterministic squad can't be seeded against the
 * live Worker), but the pick map loads the REAL map transform from the built preview, so the pin +
 * stage dots sit on real georeferenced stages. Geolocation is granted so "My spot" runs promptless.
 */
const GROUP_ID = "01KVVF5VVAGC7PAYZE127P2GZG";
const FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

const GROUP = {
  id: GROUP_ID,
  name: "Fam Juntos",
  emoji: "🎪",
  festivalId: FESTIVAL_ID,
  createdByUserId: "u-you",
  memberCount: 5,
  role: "owner",
  inviteToken: null,
};

const MEMBERS = [
  { userId: "u-you", displayName: "Julio", avatarColor: "#F5A623", role: "owner", isYou: true },
  { userId: "u-ana", displayName: "Ana", avatarColor: "#FF5A36", role: "member", isYou: false },
  { userId: "u-mara", displayName: "Mara", avatarColor: "#16A34A", role: "member", isYou: false },
];

const POINT = {
  id: "mp-1",
  groupId: GROUP_ID,
  createdByUserId: "u-you",
  createdByName: "Julio",
  isMine: true,
  title: "Regroup at the bar 🍻",
  note: "I'll grab a round 🍻",
  lat: 51.091,
  lng: 4.013,
  landmarkLabel: "between FREEDOM BY BUD & CORE",
  meetAtUtc: null,
  expiresAtUtc: new Date(Date.now() + 30 * 60_000).toISOString(),
  createdAtUtc: new Date().toISOString(),
  members: [{ userId: "u-you", displayName: "Julio", avatarColor: "#F5A623", isYou: true, status: "going", updatedAtUtc: new Date().toISOString() }],
  goingCount: 1,
  hereCount: 0,
  myStatus: "going",
};

const SEED = (arg) => {
  localStorage.setItem("fp.auth.v1", JSON.stringify({ token: arg.token, user: arg.user }));
  localStorage.setItem("fp.share.v1", "1");
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

// Block the service worker: this spec navigates several times within one test, and once the SW
// activates it intercepts /api fetches (network-first) — bypassing page.route and hitting the real
// Worker, which rejects the fake token. Blocking it keeps every fetch on the deterministic stubs.
test.use({ geolocation: { latitude: 51.0915, longitude: 4.013 }, permissions: ["geolocation"], serviceWorkers: "block" });

test.describe("Phase 6 — meeting points (Gate 6.1)", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SEED, {
      token: "anon.01KVVF5VVAGC7PAYZE127P2GZG",
      user: { displayName: "Julio", avatarColor: "#F5A623" },
      festivalId: FESTIVAL_ID,
      w1: W1,
    });
    let created = false;
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const method = req.method();
      if (path === "/api/groups/mine" && method === "GET") {
        return route.fulfill({ json: { groups: [GROUP] } });
      }
      if (path.endsWith("/meeting-points") && method === "POST") {
        created = true;
        return route.fulfill({ status: 201, json: { meetingPoint: POINT } });
      }
      if (path.endsWith("/meeting-points") && method === "GET") {
        return route.fulfill({ json: { meetingPoints: created ? [POINT] : [] } });
      }
      if (path.endsWith("/safety") && method === "GET") {
        return route.fulfill({ json: { safetyPoints: [] } });
      }
      if (path.endsWith("/presence") && method === "GET") {
        return route.fulfill({ json: { presence: { groupId: GROUP_ID, memberCount: 3, liveCount: 0, me: { shareMode: "stage", live: false, liveSecondsLeft: null }, inbox: [], members: [] } } });
      }
      if (path.endsWith("/board") && method === "GET") {
        return route.fulfill({ json: { notes: [] } });
      }
      if (/^\/api\/groups\/[^/]+$/.test(path) && method === "GET") {
        return route.fulfill({ json: { group: GROUP, members: MEMBERS } });
      }
      return route.fulfill({ json: {} });
    });
  });

  test("create flow: squad home → pick spot → details → active card (#26.1/#26.2)", async ({ page }) => {
    // 1 · Squad home shows the meeting-point CTA (no active point yet).
    await page.goto("/squad");    await expect(page.getByText("Set a meeting point")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Drop a spot for the squad to regroup")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase6-squad-home.png" });

    // 2 · Pick the spot on the real festival map.
    await page.getByText("Set a meeting point").click();
    await page.waitForURL(`**/squad/${GROUP_ID}/meet`);    await expect(page.getByRole("heading", { name: "Set a meeting point" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /My spot/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /A stage/ })).toBeVisible();
    // Use my current spot (geolocation granted) so a pin is guaranteed, then continue.
    await page.getByRole("button", { name: /My spot/ }).click();
    await expect(page.getByRole("button", { name: "Use this spot" })).toBeEnabled();
    await page.screenshot({ path: "e2e/screenshots/phase6-pick-spot.png" });

    // 3 · Details — name / when / who / note.
    await page.getByRole("button", { name: "Use this spot" }).click();
    await page.waitForURL(`**/squad/${GROUP_ID}/meet/new`);    await expect(page.getByRole("heading", { name: "Meeting point" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("When", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "In 30 min" })).toBeVisible();
    await expect(page.getByText(/Whole squad/)).toBeVisible();
    await page.getByPlaceholder("Regroup at the bar 🍻").fill("Regroup at the bar 🍻");
    await page.screenshot({ path: "e2e/screenshots/phase6-details.png" });

    // 4 · Send → POST carries the exact spot + title, then returns to the squad home.
    const post = page.waitForRequest((r) => r.url().includes(`/groups/${GROUP_ID}/meeting-points`) && r.method() === "POST");
    await page.getByRole("button", { name: "Send to squad" }).click();
    const body = JSON.parse((await post).postData() ?? "{}");
    expect(typeof body.lat).toBe("number");
    expect(typeof body.lng).toBe("number");
    expect(body.title).toContain("Regroup");

    // 5 · The active point card lands on the squad home.
    await page.waitForURL("**/squad");    await expect(page.getByText("Regroup at the bar 🍻")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("between FREEDOM BY BUD & CORE")).toBeVisible();
    await expect(page.getByText(/1 going/)).toBeVisible();
    await expect(page.getByText("Active")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase6-active-card.png" });
  });

  // Gate 7 (E19/DEC-102): the meeting-point photo opens a full-screen pinch-zoom lightbox.
  test("photo lightbox: tap the meeting photo → it opens full-screen → close (E19)", async ({ page }) => {
    const PHOTO =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const POINT_WITH_PHOTO = { ...POINT, photoUrl: PHOTO, lifecycle: "active", everyoneHere: false, creatorDrifted: false };
    // A specific route for the single-point GET takes precedence over the broad beforeEach stub.
    await page.route(`**/api/groups/${GROUP_ID}/meeting-points/mp-1`, (route) => {
      if (route.request().method() === "GET") return route.fulfill({ json: { meetingPoint: POINT_WITH_PHOTO } });
      return route.fallback();
    });

    await page.goto(`/squad/${GROUP_ID}/meet/mp-1`);    await expect(page.getByText("Regroup at the bar 🍻")).toBeVisible({ timeout: 20_000 });

    // The photo is tappable; tapping opens the lightbox overlay.
    await page.getByRole("button", { name: "Tap to zoom" }).click();
    await expect(page.locator(".lightbox")).toBeVisible();
    await expect(page.locator(".lightbox-img")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/g7-photo-lightbox.png", fullPage: true });

    // The ✕ closes it.
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".lightbox")).toHaveCount(0);
  });
});
