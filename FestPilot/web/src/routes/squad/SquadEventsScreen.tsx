/**
 * Squad agenda (Phase 8 — fixed-time group events, roadmap D2/Q5/Q6). The squad's "let's do this
 * together" moments (e.g. "photo at the Mainstage, 16:00"). Any member can add one; the creator OR
 * the squad owner can delete it. This is a layer ALONGSIDE the squad plan — it never touches the set
 * aggregation or any personal lock. Each event shows a live countdown, an optional stage + map link,
 * and a lightweight "✓ seen" so the squad knows who's in the loop.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useGroupEvents } from "../../data/groupEvents";
import { useLineup } from "../../data/useLineup";
import { stageColor, timeInZone } from "../../lib/format";
import { haptic } from "../../lib/haptics";
import { Sheet } from "../../ui/Sheet";
import { ErrorState, LoadingState } from "../../ui/states";
import type { GroupEventDto, StageDto } from "../../data/types";
import { eventBadge, eventCountdown, eventLifecycleFromIso } from "./eventsUi";

export function SquadEventsScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { group } = useGroup(id);
  const { events, status, reload } = useGroupEvents(id);
  const lineup = useLineup();
  const tz = lineup.lineup?.festival.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const stages = lineup.lineup?.stages ?? [];

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const [creating, setCreating] = useState(false);

  const count = group?.memberCount ?? 0;
  const groupLabel = group ? `${group.emoji ? `${group.emoji} ` : ""}${group.name} · ${count} ${count === 1 ? "person" : "people"}` : "Squad";
  const header = <StackHeader title="Squad agenda" />;

  if (status === "loading") {
    return (
      <>
        {header}
        <LoadingState rows={3} />
      </>
    );
  }
  if (status === "error") {
    return (
      <>
        {header}
        <ErrorState message="Could not load the squad agenda." onRetry={reload} />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="screen squad-events">
        <div className="eyebrow">{groupLabel}</div>
        <p className="squad-plan-hint">Fixed-time moments the whole squad commits to · separate from the set plan</p>

        {events.length === 0 ? (
          <div className="squad-plan-empty glass">
            <span className="ms">event</span>
            <div className="squad-plan-empty-title">No squad moments yet</div>
            <p>Pin a time the whole squad shows up — a photo, a meal, catching the headliner together.</p>
          </div>
        ) : (
          <div className="event-list">
            {events.map((event) => (
              <EventRow key={event.id} event={event} tz={tz} nowMs={now} groupId={id!} onChanged={reload} navigate={navigate} />
            ))}
          </div>
        )}

        <button className="btn btn-primary squad-events-add" onClick={() => setCreating(true)}>
          <span className="ms">add</span>
          New squad moment
        </button>
      </div>

      {creating && id && (
        <CreateEventSheet
          groupId={id}
          tz={tz}
          stages={stages}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
}

function EventRow({
  event,
  tz,
  nowMs,
  groupId,
  onChanged,
  navigate,
}: {
  event: GroupEventDto;
  tz: string;
  nowMs: number;
  groupId: string;
  onChanged: () => void;
  navigate: (to: string) => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const lifecycle = eventLifecycleFromIso(event.startsAtUtc, event.endsAtUtc, nowMs);
  const badge = eventBadge(lifecycle);
  const countdown = eventCountdown(event.startsAtUtc, event.endsAtUtc, nowMs);
  const owner = event.isMine ? "you" : event.createdByName ?? "a squadmate";

  const toggleSeen = async (): Promise<void> => {
    if (busy || event.mySeen) return;
    setBusy(true);
    haptic("light");
    try {
      await api.markEventSeen(groupId, event.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    haptic("medium");
    try {
      await api.deleteGroupEvent(groupId, event.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`glass event-card${lifecycle === "live" ? " is-live" : ""}`}>
      <div className="event-card-time">
        <span className="event-card-clock poster">{timeInZone(event.startsAtUtc, tz)}</span>
        <span className="event-card-dash">{timeInZone(event.endsAtUtc, tz)}</span>
      </div>
      <div className="event-card-main">
        <div className="event-card-head">
          <span className="event-card-title">{event.title}</span>
          <span className={`pill meet-badge meet-badge-${badge.tone}`}>{badge.label}</span>
        </div>
        <div className="event-card-meta">
          {event.stageName && (
            <span className="event-card-stage">
              <span className="dot" style={{ background: stageColor(event.stageName) }} />
              {event.stageName}
            </span>
          )}
          <span>· {countdown}</span>
          <span>· by {owner}</span>
        </div>
        {event.note && <div className="event-card-note">"{event.note}"</div>}
        <div className="event-card-actions">
          <button
            className={`event-seen${event.mySeen ? " on" : ""}`}
            onClick={() => void toggleSeen()}
            disabled={busy || event.mySeen}
            aria-pressed={event.mySeen}
          >
            <span className="ms" aria-hidden="true">{event.mySeen ? "check_circle" : "check_circle_outline"}</span>
            {event.mySeen ? "Seen" : "Got it"}
            {event.seenCount > 0 && <span className="event-seen-count"> · {event.seenCount}/{event.memberCount}</span>}
          </button>
          {event.stageName && (
            <button className="event-map-link" onClick={() => navigate("/map")}>
              <span className="ms" aria-hidden="true">map</span>
              On the map
            </button>
          )}
          {event.canDelete && (
            <button className="event-delete" onClick={() => void remove()} disabled={busy} aria-label="Delete event">
              <span className="ms" aria-hidden="true">delete</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const DURATIONS = [
  { id: "30", label: "30 min", min: 30 },
  { id: "60", label: "1 hour", min: 60 },
  { id: "90", label: "1.5 hours", min: 90 },
  { id: "120", label: "2 hours", min: 120 },
];

/** Seed the start at the next quarter-hour ~30 min out, formatted for a local `datetime-local` input. */
function defaultStartLocal(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateEventSheet({
  groupId,
  tz,
  stages,
  onClose,
  onCreated,
}: {
  groupId: string;
  tz: string;
  stages: StageDto[];
  onClose: () => void;
  onCreated: () => void;
}): JSX.Element {
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState(defaultStartLocal);
  const [durationId, setDurationId] = useState("30");
  const [stageId, setStageId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const startMs = useMemo(() => Date.parse(startLocal), [startLocal]);
  const durationMin = DURATIONS.find((d) => d.id === durationId)?.min ?? 30;
  const valid = title.trim() !== "" && Number.isFinite(startMs);
  const endPreview = Number.isFinite(startMs) ? timeInZone(new Date(startMs + durationMin * 60_000).toISOString(), tz) : "--:--";

  const submit = async (): Promise<void> => {
    if (!valid || busy) return;
    setBusy(true);
    setError(false);
    try {
      const startsAtUtc = new Date(startMs).toISOString();
      const endsAtUtc = new Date(startMs + durationMin * 60_000).toISOString();
      await api.createGroupEvent(groupId, {
        title: title.trim(),
        startsAtUtc,
        endsAtUtc,
        stageId,
        note: note.trim() || null,
      });
      haptic("medium");
      onCreated();
    } catch {
      setBusy(false);
      setError(true);
    }
  };

  return (
    <Sheet onClose={onClose} label="New squad moment">
      <div className="sheet-head">
        <div className="poster sheet-title">New squad moment</div>
        <button className="ms sheet-x" onClick={onClose}>close</button>
      </div>
      <div className="sheet-body">
        <label className="block-field">
          <span className="block-field-label">What</span>
          <input
            className="block-input"
            value={title}
            maxLength={80}
            placeholder="Squad photo 📸"
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Event title"
          />
        </label>

        <label className="block-field">
          <span className="block-field-label">Starts</span>
          <input
            className="block-input"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            aria-label="Event start"
          />
        </label>

        <div className="block-field">
          <span className="block-field-label">For how long</span>
          <div className="event-durations">
            {DURATIONS.map((d) => (
              <button
                key={d.id}
                className={`chip${durationId === d.id ? " on" : ""}`}
                onClick={() => setDurationId(d.id)}
                aria-pressed={durationId === d.id}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="event-end-preview">Ends ~{endPreview}</span>
        </div>

        {stages.length > 0 && (
          <div className="block-field">
            <span className="block-field-label">Where (optional)</span>
            <div className="event-stages">
              <button className={`chip${stageId === null ? " on" : ""}`} onClick={() => setStageId(null)} aria-pressed={stageId === null}>
                No stage
              </button>
              {stages.map((s) => (
                <button
                  key={s.id}
                  className={`chip${stageId === s.id ? " on" : ""}`}
                  onClick={() => setStageId(s.id)}
                  aria-pressed={stageId === s.id}
                >
                  <span className="dot" style={{ background: stageColor(s.name) }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block-field">
          <span className="block-field-label">Note (optional)</span>
          <input
            className="block-input"
            value={note}
            maxLength={280}
            placeholder="meet by the flag 🚩"
            onChange={(e) => setNote(e.target.value)}
            aria-label="Event note"
          />
        </label>

        {error && <p className="block-error"><span className="ms" style={{ fontSize: 14 }}>error</span> Couldn't create that — check your connection and try again.</p>}

        <button className="btn btn-primary" disabled={!valid || busy} onClick={() => void submit()}>
          <span className="ms">campaign</span>
          {busy ? "Sending…" : "Send to squad"}
        </button>
      </div>
    </Sheet>
  );
}
