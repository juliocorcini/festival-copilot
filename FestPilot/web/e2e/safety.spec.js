import { test, expect } from "@playwright/test";

/**
 * Phase 6 / Gate 6.3 — "I'm lost" safety (#26.5 menu, #26.6 active broadcast) + compass navigation
 * (#26 nav). The safety flow: open the calm menu → "Share my location + alert squad" (POST carries
 * isSafety) → the active broadcast (squad converging) → "I'm okay" stops it. The nav screen shows a
 * compass arrow + live distance/ETA from the granted GPS fix to the spot.
 *
 * Group + meeting endpoints are stubbed (no deterministic squad against the live Worker). The map
 * transform loads from the real preview build, so the local "nearest landmark" + arrow are genuine.
 */

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const GROUP_ID = "01KVVF5VVAGC7PAYZE127P2GZG";
const FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";
const SOS_ID = "sos-1";
const MP_ID = "mp-1";

const GROUP = {
  id: GROUP_ID, name: "Fam Juntos", emoji: "🎪", festivalId: FESTIVAL_ID,
  createdByUserId: "u-you", memberCount: 3, role: "owner", inviteToken: null,
};

const member = (userId, displayName, avatarColor, isYou, status, eta = null, dist = null) => ({
  userId, displayName, avatarColor, isYou, status,
  updatedAtUtc: new Date().toISOString(), etaMinutes: eta, distanceMeters: dist,
});

const SOS_POINT = {
  id: SOS_ID, groupId: GROUP_ID, createdByUserId: "u-you", createdByName: "Julio",
  isMine: true, isSafety: true, title: "Julio needs help", note: null,
  lat: 51.091, lng: 4.013, landmarkLabel: "near FREEDOM BY BUD",
  meetAtUtc: null, expiresAtUtc: new Date(Date.now() + 240 * 60_000).toISOString(),
  createdAtUtc: new Date().toISOString(),
  members: [
    member("u-you", "Julio", "#F5A623", true, "going"),
    member("u-ana", "Ana", "#FF5A36", false, "going", 2, 150),
    member("u-mara", "Mara", "#16A34A", false, "no_response"),
  ],
  goingCount: 2, hereCount: 0, myStatus: "going", lifecycle: "active",
  everyoneHere: false, creatorDrifted: false,
};

const MEET_POINT = {
  ...SOS_POINT, id: MP_ID, isSafety: false, title: "Regroup at Cactus Bar 🌵",
  landmarkLabel: "between FREEDOM BY BUD & CORE",
};

const SEED = (arg) => {
  localStorage.setItem("fp.auth.v1", JSON.stringify({ token: arg.token, user: arg.user }));
  localStorage.setItem("fp.share.v1", "1");
  localStorage.setItem(
    "fp.store.v1",
    JSON.stringify({ v: 1, onboarding: { festivalId: arg.festivalId, weekendIds: [arg.w1], dayKeys: [], completed: true }, favorites: {}, plans: {} })
  );
};

// A spot ~55 m north of the squadmate's fix — far enough to read a real distance, not "arrived".
test.use({ geolocation: { latitude: 51.0915, longitude: 4.013 }, permissions: ["geolocation"], serviceWorkers: "block" });

test.describe("Phase 6 — safety & navigation (Gate 6.3)", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SEED, {
      token: "anon.01KVVF5VVAGC7PAYZE127P2GZG",
      user: { displayName: "Julio", avatarColor: "#F5A623" },
      festivalId: FESTIVAL_ID,
      w1: W1,
    });
  });

  test("'I'm lost' menu → share + alert → active broadcast → I'm okay (#26.5/#26.6)", async ({ page }) => {
    let broadcasting = false;
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const method = req.method();
      if (path.endsWith("/safety") && method === "GET") {
        return route.fulfill({ json: { safetyPoints: broadcasting ? [SOS_POINT] : [] } });
      }
      if (path.endsWith("/meeting-points") && method === "POST") {
        broadcasting = true;
        return route.fulfill({ json: { meetingPoint: SOS_POINT } });
      }
      if (path.endsWith(`/meeting-points/${SOS_ID}/end`) && method === "POST") {
        broadcasting = false;
        return route.fulfill({ json: { meetingPoint: { ...SOS_POINT, lifecycle: "expired" } } });
      }
      if (path === "/api/groups/mine" && method === "GET") return route.fulfill({ json: { groups: [GROUP] } });
      if (/^\/api\/groups\/[^/]+$/.test(path) && method === "GET") return route.fulfill({ json: { group: GROUP, members: [] } });
      return route.fulfill({ json: {} });
    });

    // 1 · The calm menu (#26.5).
    await page.goto(`/squad/${GROUP_ID}/safety`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByText("It happens to everyone")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Share my location + alert squad")).toBeVisible();
    await expect(page.getByText("Find the nearest landmark")).toBeVisible();
    await expect(page.getByText("Medical / info / exit")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase6-safety-menu.png", fullPage: true });

    // 2 · Share + alert → POST carries isSafety:true.
    const post = page.waitForRequest((r) => r.url().endsWith("/meeting-points") && r.method() === "POST");
    await page.getByText("Share my location + alert squad").click();
    const body = JSON.parse((await post).postData() ?? "{}");
    expect(body.isSafety).toBe(true);
    expect(typeof body.lat).toBe("number");

    // 3 · The active broadcast (#26.6): banner, the squad converging, and "I'm okay".
    await expect(page.getByText("Squad alerted · your live location is shared")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Ana")).toBeVisible();
    await expect(page.getByText("~2 min · 150m")).toBeVisible();
    await expect(page.getByRole("button", { name: "I'm okay — stop sharing" })).toBeVisible();
    await page.addStyleTag({ content: FREEZE });
    await page.screenshot({ path: "e2e/screenshots/phase6-safety-active.png", fullPage: true });

    // 4 · "I'm okay" → POST close → back to the calm menu.
    const end = page.waitForRequest((r) => r.url().endsWith(`/meeting-points/${SOS_ID}/end`) && r.method() === "POST");
    await page.getByRole("button", { name: "I'm okay — stop sharing" }).click();
    expect(JSON.parse((await end).postData() ?? "{}").mode).toBe("close");
    await expect(page.getByText("It happens to everyone")).toBeVisible({ timeout: 20_000 });
  });

  test("compass navigation shows the live distance + ETA to the spot", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith(`/meeting-points/${MP_ID}`)) return route.fulfill({ json: { meetingPoint: MEET_POINT } });
      return route.fulfill({ json: {} });
    });

    await page.goto(`/squad/${GROUP_ID}/meet/${MP_ID}/nav`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByText("Regroup at Cactus Bar 🌵")).toBeVisible({ timeout: 20_000 });
    // A live ETA derived from the granted GPS fix (≈55 m away → ~1 min walk) + the compass arrow.
    await expect(page.getByText(/min walk/)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".nav-arrow")).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase6-nav.png", fullPage: true });
  });
});
