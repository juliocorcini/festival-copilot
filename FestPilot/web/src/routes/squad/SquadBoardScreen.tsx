/**
 * Group board (Gate 4.4 — UC-39, DEC-013). A lightweight, pinned notes board — explicitly NOT chat.
 * Anyone in the squad posts; the author edits/removes their own; the owner can remove any (moderation)
 * and pin/unpin to float a note to the top. Realtime via the GroupRoom "board" fan-out (useBoard).
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useBoard } from "../../data/board";
import { useGroup } from "../../data/groups";
import { initialsOf } from "../../data/identity";
import type { BoardNoteDto } from "../../data/types";
import { ErrorState, LoadingState } from "../../ui/states";

const MAX = 280;
const FALLBACK_COLOR = "#6B7280";

export function SquadBoardScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { group } = useGroup(id);
  const { notes, status, reload } = useBoard(id);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const isOwner = group?.role === "owner";

  const post = async (): Promise<void> => {
    const body = draft.trim();
    if (!body || !id || posting) return;
    setPosting(true);
    try {
      await api.postNote(id, body.slice(0, MAX));
      setDraft("");
      reload();
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <StackHeader title={`${group?.emoji ? `${group.emoji} ` : ""}Squad board`} backTo="/squad" />
      <div className="screen squad-board">
        <p className="board-intro">Pin plans, meet points and shout-outs. Everyone in the squad sees these — it's not a chat.</p>

        {status === "loading" && <LoadingState rows={3} />}
        {status === "error" && <ErrorState message="Could not load the board." onRetry={reload} />}

        {status === "ready" && notes.length === 0 && (
          <div className="glass board-empty">
            <span className="ms">push_pin</span>
            <div className="board-empty-title">Nothing pinned yet</div>
            <p>Drop the first note — where to meet, the can't-miss set, the after-plan.</p>
          </div>
        )}

        {status === "ready" && notes.length > 0 && (
          <div className="board-list">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                groupId={id!}
                canModerate={isOwner}
                onChanged={reload}
              />
            ))}
          </div>
        )}
      </div>

      <div className="board-composer">
        <textarea
          className="field board-input"
          placeholder="Add a note for the squad…"
          maxLength={MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
        />
        <button
          className="btn btn-primary board-post"
          aria-label="Post"
          onClick={post}
          disabled={posting || draft.trim() === ""}
        >
          <span className="ms" aria-hidden="true">push_pin</span>
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </>
  );
}

function NoteCard({
  note,
  groupId,
  canModerate,
  onChanged,
}: {
  note: BoardNoteDto;
  groupId: string;
  canModerate: boolean;
  onChanged: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const color = note.authorColor ?? FALLBACK_COLOR;

  const run = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (): Promise<void> => {
    const next = body.trim();
    if (!next) return;
    await run(async () => {
      await api.editNote(groupId, note.id, next.slice(0, MAX));
      setEditing(false);
    });
  };

  return (
    <article className={`glass board-note${note.pinned ? " pinned" : ""}`}>
      {note.pinned && (
        <div className="board-pin-flag">
          <span className="ms">push_pin</span> Pinned
        </div>
      )}
      <header className="board-note-head">
        <span
          className="ava board-ava"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: "#0F0D09" }}
        >
          {initialsOf(note.authorName)}
        </span>
        <div className="board-note-who">
          <div className="board-note-name">
            {note.authorName ?? "Guest"}
            {note.isMine && <span className="member-you"> · you</span>}
          </div>
          <div className="board-note-time">
            {relativeTime(note.createdAtUtc)}
            {note.updatedAtUtc && " · edited"}
          </div>
        </div>
      </header>

      {editing ? (
        <div className="board-edit">
          <textarea
            className="field"
            maxLength={MAX}
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="board-edit-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setBody(note.body); }}>
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={busy || body.trim() === ""}>
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="board-note-body">{note.body}</p>
      )}

      {!editing && (note.isMine || canModerate) && (
        <div className="board-note-actions">
          {canModerate && (
            <button
              className="board-action"
              aria-label={note.pinned ? "Unpin" : "Pin"}
              disabled={busy}
              onClick={() => void run(() => api.pinNote(groupId, note.id, !note.pinned))}
            >
              <span className="ms" aria-hidden="true">{note.pinned ? "keep_off" : "push_pin"}</span>
              {note.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {note.isMine && (
            <button className="board-action" aria-label="Edit" disabled={busy} onClick={() => setEditing(true)}>
              <span className="ms" aria-hidden="true">edit</span>
              Edit
            </button>
          )}
          <button
            className="board-action danger"
            aria-label="Remove"
            disabled={busy}
            onClick={() => void run(() => api.deleteNote(groupId, note.id))}
          >
            <span className="ms" aria-hidden="true">delete</span>
            Remove
          </button>
        </div>
      )}
    </article>
  );
}

/** Compact relative time for the board ("now", "5m", "2h", "3d", or a date). */
function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
