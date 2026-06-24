// Media routes (DEC-059). Mounted at /api/media.
//   POST   /api/media/avatar  -> upload the caller's avatar photo (raw image body) to R2
//   DELETE /api/media/avatar  -> remove the caller's avatar photo (revert to the color initial)
// Serving is OUTSIDE this router: the Worker serves GET /media/* straight from R2 (cacheable, no
// auth) so the URL stored on the user row is a plain CDN-style link. The APP enforces the quota here
// (Cloudflare has no hard spend cap) via the pure `checkMediaQuota` over the D1 media ledger.

import { Hono } from "hono";
import type { Env } from "../env";
import { getUserFromRequest } from "../auth";
import { ensureUser, setAvatarUrl } from "./users";
import {
  checkMediaQuota,
  deleteImage,
  forgetMediaObject,
  mediaKeyFromUrl,
  mediaUsage,
  putImage,
  recordMediaObject,
} from "../media/store";

export const media = new Hono<{ Bindings: Env }>();

/** Absolute `/media/<key>` URL on the request origin (the Worker serves it back from R2). */
function mediaUrl(req: Request, key: string): string {
  return `${new URL(req.url).origin}/media/${key}`;
}

media.post("/avatar", async (c) => {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return c.json({ error: "unauthorized" }, 401);

  const nowIso = new Date().toISOString();
  const user = await ensureUser(c.env.DB, identity, nowIso, undefined, null);
  const contentType = c.req.header("content-type")?.split(";")[0]?.trim() ?? "";
  const body = await c.req.arrayBuffer();

  // Overwrite-aware accounting: the old avatar (versioned key) is replaced, so its bytes free up.
  const oldKey = mediaKeyFromUrl(user.avatarUrl);
  const usage = await mediaUsage(c.env.DB, oldKey);
  const verdict = checkMediaQuota(contentType, body.byteLength, usage);
  if (!verdict.ok) return c.json({ error: verdict.reason }, verdict.status as 400);

  const newKey = `avatars/${user.id}-${Date.now()}.${verdict.ext}`;
  await putImage(c.env, newKey, body, contentType);
  await recordMediaObject(
    c.env.DB,
    { key: newKey, kind: "avatar", ownerUserId: user.id, byteSize: body.byteLength, contentType },
    nowIso
  );
  // Drop the previous object + its ledger row (keeps R2 + the count/byte budget tight).
  if (oldKey && oldKey !== newKey) {
    await deleteImage(c.env, oldKey);
    await forgetMediaObject(c.env.DB, oldKey);
  }

  const updated = await setAvatarUrl(c.env.DB, identity.firebaseUid, mediaUrl(c.req.raw, newKey), nowIso);
  return c.json({ user: updated });
});

media.delete("/avatar", async (c) => {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return c.json({ error: "unauthorized" }, 401);

  const nowIso = new Date().toISOString();
  const user = await ensureUser(c.env.DB, identity, nowIso, undefined, null);
  const oldKey = mediaKeyFromUrl(user.avatarUrl);
  if (oldKey) {
    await deleteImage(c.env, oldKey);
    await forgetMediaObject(c.env.DB, oldKey);
  }
  const updated = await setAvatarUrl(c.env.DB, identity.firebaseUid, null, nowIso);
  return c.json({ user: updated });
});
