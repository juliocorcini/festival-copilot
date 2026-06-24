import { test, expect } from "@playwright/test";

/**
 * Phase 6 / Gate 6.2 — meeting-point lifecycle (#26.3 active detail, #26.4 reunion, UC-28). Opens a
 * point's convergence detail (roster with live ETA / here / no-response), runs the going/here/can't
 * loop ("I'm here"), and lands on the "everyone's here" reunion once all committed members arrived.
 *
 * The group + meeting-point endpoints are stubbed (a deterministic squad can't be seeded against the
 * live Worker). The convergence map loads the REAL transform from the built preview; presence is empty
 * so only the flag pin shows. The SW is blocked so every fetch stays on the deterministic stubs.
 */

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const GROUP_ID = "01KVVF5VVAGC7PAYZE127P2GZG";
const FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";
const MP_ID = "mp-1";

const GROUP = {
  id: GROUP_ID,
  name: "Fam Juntos",
  emoji: "🎪",
  festivalId: FESTIVAL_ID,
  createdByUserId: "u-you",
  memberCount: 3,
  role: "owner",
  inviteToken: null,
};

const MEMBERS = [
  { userId: "u-you", displayName: "Julio", avatarColor: "#F5A623", role: "owner", isYou: true },
  { userId: "u-ana", displayName: "Ana", avatarColor: "#FF5A36", role: "member", isYou: false },
  { userId: "u-mara", displayName: "Mara", avatarColor: "#16A34A", role: "member", isYou: false },
];

const member = (userId, displayName, avatarColor, isYou, status, eta = null, dist = null) => ({
  userId,
  displayName,
  avatarColor,
  isYou,
  status,
  updatedAtUtc: new Date().toISOString(),
  etaMinutes: eta,
  distanceMeters: dist,
});

const POINT_BASE = {
  id: MP_ID,
  groupId: GROUP_ID,
  createdByUserId: "u-you",
  createdByName: "Julio",
  isMine: true,
  title: "Regroup at Cactus Bar 🌵",
  note: "I'll grab a round 🍻",
  lat: 51.091,
  lng: 4.013,
  landmarkLabel: "between FREEDOM BY BUD & CORE",
  meetAtUtc: null,
  expiresAtUtc: new Date(Date.now() + 30 * 60_000).toISOString(),
  createdAtUtc: new Date().toISOString(),
  creatorDrifted: false,
};

// Before "I'm here": you're heading over (ETA), Ana is here, Mara hasn't responded.
const POINT_ACTIVE = {
  ...POINT_BASE,
  members: [
    member("u-you", "Julio", "#F5A623", true, "going", 3, 220),
    member("u-ana", "Ana", "#FF5A36", false, "arrived"),
    member("u-mara", "Mara", "#16A34A", false, "no_response"),
  ],
  goingCount: 1,
  hereCount: 1,
  myStatus: "going",
  lifecycle: "on_the_way",
  everyoneHere: false,
};

// After "I'm here": both committed members arrived → the reunion (Mara's no-response doesn't block it).
const POINT_HERE = {
  ...POINT_BASE,
  members: [
    member("u-you", "Julio", "#F5A623", true, "arrived"),
    member("u-ana", "Ana", "#FF5A36", false, "arrived"),
    member("u-mara", "Mara", "#16A34A", false, "no_response"),
  ],
  goingCount: 0,
  hereCount: 2,
  myStatus: "arrived",
  lifecycle: "everyone_here",
  everyoneHere: true,
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

test.use({ geolocation: { latitude: 51.0915, longitude: 4.013 }, permissions: ["geolocation"], serviceWorkers: "block" });

test.describe("Phase 6 — meeting lifecycle (Gate 6.2)", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SEED, {
      token: "anon.01KVVF5VVAGC7PAYZE127P2GZG",
      user: { displayName: "Julio", avatarColor: "#F5A623" },
      festivalId: FESTIVAL_ID,
      w1: W1,
    });
    let imHere = false;
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const method = req.method();
      if (path.endsWith(`/meeting-points/${MP_ID}/status`) && method === "POST") {
        imHere = true;
        return route.fulfill({ json: { meetingPoint: POINT_HERE } });
      }
      if (path.endsWith(`/meeting-points/${MP_ID}`) && method === "GET") {
        return route.fulfill({ json: { meetingPoint: imHere ? POINT_HERE : POINT_ACTIVE } });
      }
      if (path.endsWith("/meeting-points") && method === "GET") {
        return route.fulfill({ json: { meetingPoints: [imHere ? POINT_HERE : POINT_ACTIVE] } });
      }
      if (path.endsWith("/presence") && method === "GET") {
        return route.fulfill({ json: { presence: { groupId: GROUP_ID, memberCount: 3, liveCount: 0, me: { shareMode: "stage", live: false, liveSecondsLeft: null }, inbox: [], members: [] } } });
      }
      if (path === "/api/groups/mine" && method === "GET") {
        return route.fulfill({ json: { groups: [GROUP] } });
      }
      if (/^\/api\/groups\/[^/]+$/.test(path) && method === "GET") {
        return route.fulfill({ json: { group: GROUP, members: MEMBERS } });
      }
      return route.fulfill({ json: {} });
    });
  });

  test("active detail → 'I'm here' → everyone's here (#26.3/#26.4)", async ({ page }) => {
    // 1 · Open the convergence detail directly.
    await page.goto(`/squad/${GROUP_ID}/meet/${MP_ID}`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByText("Regroup at Cactus Bar 🌵")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("On the way", { exact: true })).toBeVisible();
    // Roster honesty: a member with a live ETA, and one who hasn't answered (dimmed).
    await expect(page.getByText("Ana")).toBeVisible();
    await expect(page.getByText("Mara")).toBeVisible();
    await expect(page.getByText("~3 min · 220m")).toBeVisible();
    await expect(page.getByText("no response")).toBeVisible();
    await expect(page.getByRole("button", { name: "I'm here" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase6-meet-detail.png" });

    // 2 · Mark "I'm here" → POST carries the status, then the detail re-fetches.
    const post = page.waitForRequest(
      (r) => r.url().includes(`/meeting-points/${MP_ID}/status`) && r.method() === "POST"
    );
    await page.getByRole("button", { name: "I'm here" }).click();
    const body = JSON.parse((await post).postData() ?? "{}");
    expect(body.status).toBe("arrived");

    // 3 · Everyone's committed and here → the reunion moment, with the creator's close action.
    await expect(page.getByText("The squad's back together")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Everyone made it to")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close point" })).toBeVisible();
    await page.addStyleTag({ content: FREEZE });
    await page.screenshot({ path: "e2e/screenshots/phase6-meet-everyone-here.png" });
  });
});
