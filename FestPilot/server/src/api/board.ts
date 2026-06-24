// Group board store (Pillar 3a, Gate 4.4 — UC-39, DEC-013). A lightweight pinned-notes board,
// explicitly NOT chat. D1 is the source of truth; the GroupRoom DO only fans out a "board" change
// so clients re-fetch (same contract as groups/plan). Permissions: an author edits/removes their
// own note; the owner can remove any note and pin/unpin (moderation). Notes are short (capped).

import { ulid } from "../db/ids";
import type { BoardNoteDto } from "./dto";

export const MAX_NOTE_LENGTH = 280;

interface NoteRow {
  id: string;
  authorUserId: string;
  authorName: string | null;
  authorColor: string | null;
  body: string;
  pinned: number;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

function toDto(row: NoteRow, meId: string): BoardNoteDto {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    authorColor: row.authorColor,
    isMine: row.authorUserId === meId,
    body: row.body,
    pinned: Number(row.pinned) === 1,
    createdAtUtc: row.createdAtUtc,
    updatedAtUtc: row.updatedAtUtc,
  };
}

/** The board for a group: pinned notes first, then newest-first. */
export async function listNotes(db: D1Database, groupId: string, meId: string): Promise<BoardNoteDto[]> {
  const rows = await db
    .prepare(
      `SELECT n.id AS id, n.author_user_id AS authorUserId, u.display_name AS authorName,
              u.avatar_color AS authorColor, n.body AS body, n.pinned AS pinned,
              n.created_at_utc AS createdAtUtc, n.updated_at_utc AS updatedAtUtc
         FROM group_board_note n
         JOIN app_user u ON u.id = n.author_user_id
        WHERE n.group_id = ?
        ORDER BY n.pinned DESC, n.created_at_utc DESC`
    )
    .bind(groupId)
    .all<NoteRow>();
  return rows.results.map((r) => toDto(r, meId));
}

/** Post a new note. Body is trimmed + capped; empty bodies are rejected by the caller. */
export async function postNote(
  db: D1Database,
  groupId: string,
  authorUserId: string,
  body: string,
  nowIso: string
): Promise<BoardNoteDto> {
  const id = ulid();
  await db
    .prepare(
      `INSERT INTO group_board_note (id, group_id, author_user_id, body, pinned, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, 0, ?, NULL)`
    )
    .bind(id, groupId, authorUserId, body, nowIso)
    .run();
  return {
    id,
    authorUserId,
    authorName: null,
    authorColor: null,
    isMine: true,
    body,
    pinned: false,
    createdAtUtc: nowIso,
    updatedAtUtc: null,
  };
}

/** Edit a note's body — author only. Returns false when the note is missing or not the author's. */
export async function editNote(
  db: D1Database,
  groupId: string,
  noteId: string,
  authorUserId: string,
  body: string,
  nowIso: string
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE group_board_note SET body = ?, updated_at_utc = ?
        WHERE id = ? AND group_id = ? AND author_user_id = ?`
    )
    .bind(body, nowIso, noteId, groupId, authorUserId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/** Pin/unpin a note — owner only (enforced in the route). */
export async function setPinned(
  db: D1Database,
  groupId: string,
  noteId: string,
  pinned: boolean
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE group_board_note SET pinned = ? WHERE id = ? AND group_id = ?`)
    .bind(pinned ? 1 : 0, noteId, groupId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/** Remove a note. The author may remove their own; the owner may remove any (`isOwner`). */
export async function removeNote(
  db: D1Database,
  groupId: string,
  noteId: string,
  requesterId: string,
  isOwner: boolean
): Promise<boolean> {
  const res = isOwner
    ? await db
        .prepare(`DELETE FROM group_board_note WHERE id = ? AND group_id = ?`)
        .bind(noteId, groupId)
        .run()
    : await db
        .prepare(`DELETE FROM group_board_note WHERE id = ? AND group_id = ? AND author_user_id = ?`)
        .bind(noteId, groupId, requesterId)
        .run();
  return (res.meta.changes ?? 0) > 0;
}
