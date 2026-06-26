import { test, expect } from "./fixtures.js";

/**
 * Gate 4.4 — group board (UC-39, DEC-013). Drives the real flow against the live Worker:
 * post a pinned note (#23.7 → board) → edit → pin → remove. Lightweight notes, not chat.
 */
const API = "https://festpilot.trippilot.workers.dev";

let FESTIVAL_ID = "01KVVF5VERH4AB28NAM6NM65VD";
const W1 = "01KVVF5VVAGC7PAYZE127P2GZG";

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

async function makeUser(request, name, color = "#0EA5E9") {
  const tok = `anon.${ulid()}`;
  const r = await request.put(`${API}/api/me`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { displayName: name, avatarColor: color },
  });
  const user = (await r.json()).user ?? { displayName: name, avatarColor: color };
  return { tok, user };
}

async function createGroup(request, tok, name = "BOARD SQUAD", emoji = "📌") {
  const r = await request.post(`${API}/api/groups`, {
    headers: { authorization: `Bearer ${tok}` },
    data: { name, emoji, festivalId: FESTIVAL_ID },
  });
  return (await r.json()).group;
}

const SEED = (arg) => {
  localStorage.setItem("fp.auth.v1", JSON.stringify({ token: arg.token, user: arg.user }));
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

test.describe("Gate 4.4 — group board", () => {
  // Heavy flow: 6+ sequential live-Worker round-trips (user, group, post, pin, edit, remove)
  // plus a real page load. The default 30s budget is too tight; give it room so transient
  // network latency doesn't flake the gate.
  test.setTimeout(120_000);

  test("post → edit → pin → remove a pinned note", async ({ page, request }) => {
    const owner = await makeUser(request, "Julio");
    const group = await createGroup(request, owner.tok);

    await page.addInitScript(SEED, { token: owner.tok, user: owner.user, festivalId: FESTIVAL_ID, w1: W1 });
    await page.goto(`/squad/${group.id}/board`);
    // Empty state.
    await expect(page.getByText("Nothing pinned yet")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-board-empty.png" });

    // Post a note.
    await page.getByPlaceholder("Add a note for the squad…").fill("Meet at the windmill at 18:00");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("Meet at the windmill at 18:00")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Julio", { exact: false }).first()).toBeVisible();

    // Pin it (owner) → Pinned flag.
    await page.getByRole("button", { name: "Pin", exact: true }).click();
    await expect(page.getByText("Pinned")).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: "e2e/screenshots/phase4-board-note.png" });

    // Edit it → edited hint.
    await page.getByRole("button", { name: "Edit" }).click();
    const editBox = page.locator(".board-edit textarea");
    await editBox.fill("Meet at the windmill at 19:00");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Meet at the windmill at 19:00")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/· edited/)).toBeVisible();

    // Remove it → back to empty.
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Nothing pinned yet")).toBeVisible({ timeout: 20_000 });
  });
});
