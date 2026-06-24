import { test, expect } from "@playwright/test";

/**
 * Phase 5 — live presence (#25). Visual + behaviour check of the three coarse-presence screens:
 * consent pre-prompt (#25.1), "where's the squad" roster (#25.4), precise control (#25.5).
 *
 * The roster is a multi-member, multi-stage snapshot that can't be seeded against the live Worker
 * deterministically, so the presence/group endpoints are stubbed. The map peek still loads the REAL
 * map transform from the built preview, so coarse pins land on real georeferenced stages. Geolocation
 * is granted at the context level so the foreground sharing engine runs without a prompt.
 */

const FREEZE = `*,*::before,*::after{animation:none!important;transition:none!important}`;
const GROUP_ID = "01KVVF5VVAGC7PAYZE127P2GZG";
const FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

const GROUP = {
  id: GROUP_ID,
  name: "Fam Juntos",
  emoji: "🎪",
  festivalId: FESTIVAL_ID,
  createdByUserId: "owner",
  memberCount: 5,
  role: "owner",
  inviteToken: null,
};

function coarse(over) {
  return {
    coarseLabel: "at",
    stageName: "MAINSTAGE",
    betweenStageName: null,
    currentArtistName: null,
    confidence: "high",
    source: "gps",
    updatedAtUtc: "2026-07-18T20:30:00Z",
    stale: false,
    ageSeconds: 10,
    ...over,
  };
}

const ROSTER = {
  groupId: GROUP_ID,
  memberCount: 5,
  liveCount: 1,
  me: { shareMode: "precise", live: true, liveSecondsLeft: 2820 },
  inbox: [],
  members: [
    { userId: "u-you", displayName: "Julio", avatarColor: "#F5A623", role: "owner", isYou: true, shareMode: "precise", live: true, liveSecondsLeft: 2820, presence: coarse({ stageName: "FREEDOM BY BUD" }) },
    { userId: "u-ana", displayName: "Ana", avatarColor: "#FF5A36", role: "member", isYou: false, shareMode: "stage", live: false, liveSecondsLeft: null, presence: coarse({ stageName: "MAINSTAGE", currentArtistName: "Charlotte de Witte", ageSeconds: 10 }) },
    { userId: "u-mara", displayName: "Mara", avatarColor: "#16A34A", role: "member", isYou: false, shareMode: "stage", live: false, liveSecondsLeft: null, presence: coarse({ coarseLabel: "near", stageName: "CORE", ageSeconds: 240 }) },
    { userId: "u-theo", displayName: "Theo", avatarColor: "#7C3AED", role: "member", isYou: false, shareMode: "stage", live: false, liveSecondsLeft: null, presence: coarse({ stageName: "CAGE", stale: true, ageSeconds: 1080 }) },
    { userId: "u-bruno", displayName: "Bruno", avatarColor: "#64748B", role: "member", isYou: false, shareMode: "ghost", live: false, liveSecondsLeft: null, presence: null },
  ],
};

// Same roster, but Ana has pinged "you" to locate — drives the inbox prompt + answer sheet (#25.4).
const ROSTER_INBOX = {
  ...ROSTER,
  inbox: [{ id: "ping-1", fromUserId: "u-ana", fromName: "Ana", kind: "locate", createdAtUtc: "2026-07-18T20:29:00Z" }],
};

const STAGES = [
  { id: "s-main", sourceStageId: "main", name: "MAINSTAGE", sortOrder: 0 },
  { id: "s-core", sourceStageId: "core", name: "CORE", sortOrder: 1 },
  { id: "s-cage", sourceStageId: "cage", name: "CAGE", sortOrder: 2 },
  { id: "s-free", sourceStageId: "free", name: "FREEDOM BY BUD", sortOrder: 3 },
];

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

test.use({ geolocation: { latitude: 51.0915, longitude: 4.013 }, permissions: ["geolocation"] });

test.describe("Phase 5 — live presence", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(SEED, {
      token: "anon.01KVVF5VVAGC7PAYZE127P2GZG",
      user: { displayName: "Julio", avatarColor: "#F5A623" },
      festivalId: FESTIVAL_ID,
      w1: W1,
    });
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const method = req.method();
      if (path.startsWith("/api/groups/") && path.endsWith("/presence") && method === "GET") {
        return route.fulfill({ json: { presence: ROSTER } });
      }
      if (path === "/api/presence" && method === "POST") {
        return route.fulfill({ json: { ok: true, groups: 1 } });
      }
      if (path === "/api/presence/pause" && method === "POST") {
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/share") && method === "PUT") {
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/stages") && method === "GET") {
        return route.fulfill({ json: { stages: STAGES } });
      }
      if (/\/ping(\/[^/]+\/(answer|dismiss))?$/.test(path) && method === "POST") {
        return route.fulfill({ json: { ok: true } });
      }
      if (/^\/api\/groups\/[^/]+$/.test(path) && method === "GET") {
        return route.fulfill({ json: { group: GROUP, members: ROSTER.members.map((m) => ({ userId: m.userId, displayName: m.displayName, avatarColor: m.avatarColor, role: m.role, isYou: m.isYou })) } });
      }
      return route.fulfill({ json: {} });
    });
  });

  test("consent pre-prompt (#25.1)", async ({ page }) => {
    await page.goto(`/squad/${GROUP_ID}/location`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByText("Never lose your people")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("By default: just the stage")).toBeVisible();
    await expect(page.getByRole("button", { name: "Turn on location" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase5-consent.png" });
  });

  test("where's the squad roster (#25.4)", async ({ page }) => {
    await page.goto(`/squad/${GROUP_ID}/where`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByRole("heading", { name: "Where's the squad" })).toBeVisible({ timeout: 20_000 });
    // Coarse, honest labels — never a coordinate.
    await expect(page.getByText("at MAINSTAGE")).toBeVisible();
    await expect(page.getByText("near CORE")).toBeVisible();
    await expect(page.getByText("watching Charlotte de Witte")).toBeVisible();
    await expect(page.getByText("last seen 18m ago")).toBeVisible();
    await expect(page.getByText("not sharing")).toBeVisible();
    await expect(page.getByText("● live")).toBeVisible();
    // The invisible banner must be gone (we're opted in + granted).
    await expect(page.getByText("You're invisible to the squad")).toHaveCount(0);
    await page.screenshot({ path: "e2e/screenshots/phase5-where.png" });
  });

  test("precise sharing control (#25.5)", async ({ page }) => {
    await page.goto(`/squad/${GROUP_ID}/precise`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByText("Sharing precise location")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Auto-off in/)).toBeVisible();
    await expect(page.getByText("can see you")).toBeVisible();
    await expect(page.getByRole("button", { name: "Stop sharing now" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Coarse" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase5-precise.png" });
  });

  test("sharing-mode picker (#25.3)", async ({ page }) => {
    await page.goto(`/squad/${GROUP_ID}/visibility`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByRole("heading", { name: "How you appear" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Sharing with Fam Juntos")).toBeVisible();
    await expect(page.getByText("Stage labels")).toBeVisible();
    await expect(page.getByText("Precise live pin")).toBeVisible();
    await expect(page.getByText("Ghost mode")).toBeVisible();
    // Per-squad scope is spelled out (DEC-015).
    await expect(page.getByText(/Visible to/)).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase5-visibility.png" });
    // Switch to Stage and save → persists the chosen mode (PUT /share) and returns to the roster.
    const savePut = page.waitForRequest(
      (r) => r.url().includes(`/groups/${GROUP_ID}/share`) && r.method() === "PUT"
    );
    await page.getByText("Stage labels").click();
    await page.getByRole("button", { name: "Save" }).click();
    const req = await savePut;
    expect(JSON.parse(req.postData() ?? "{}")).toMatchObject({ mode: "stage" });
    await page.waitForURL(`**/squad/${GROUP_ID}/where`);
  });

  test("location & privacy master switch (#25.6)", async ({ page }) => {
    await page.goto("/settings/privacy");
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByText("Share with my squads")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Default mode")).toBeVisible();
    await expect(page.getByText("Precise auto-expiry")).toBeVisible();
    await expect(page.getByText("Pause all sharing")).toBeVisible();
    // Master switch is on (seeded opt-in).
    await expect(page.getByRole("switch", { name: "Share with my squads" })).toHaveAttribute("aria-checked", "true");
    await page.screenshot({ path: "e2e/screenshots/phase5-privacy.png" });
    // Go invisible everywhere.
    const pause = page.getByRole("switch", { name: "Pause all sharing" });
    await pause.click();
    await expect(pause).toHaveAttribute("aria-checked", "true");
  });

  test("where-is-everyone ping round-trip (#25.4)", async ({ page }) => {
    // Override the roster so Ana has pinged "you".
    await page.route("**/api/groups/*/presence", (route) => route.fulfill({ json: { presence: ROSTER_INBOX } }));
    await page.goto(`/squad/${GROUP_ID}/where`);
    await page.addStyleTag({ content: FREEZE });
    await expect(page.getByRole("heading", { name: "Where's the squad" })).toBeVisible({ timeout: 20_000 });
    // Incoming ping prompt.
    await expect(page.getByText("Ana asked where you are")).toBeVisible();
    // Stale member can be pinged; ghost can be nudged.
    await expect(page.getByRole("button", { name: "Ping" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nudge" })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase5-where-ping.png" });
    // Answer with a stage (push-reply, works with GPS off) → one-tap sheet.
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText("Which stage are you at?")).toBeVisible();
    await expect(page.getByRole("button", { name: /MAINSTAGE/ })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/phase5-ping-sheet.png" });
    await page.getByRole("button", { name: /MAINSTAGE/ }).click();
    // Sheet closes after answering.
    await expect(page.getByText("Which stage are you at?")).toHaveCount(0);
  });
});
