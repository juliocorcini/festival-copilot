/**
 * Create a fixed-time group event ("a squad moment" — e.g. a photo, a meal). Extracted from the squad
 * agenda (E21) so the squad plan can surface the same flow inline: from the plan you can pin a moment
 * BETWEEN the sets. It is a layer ALONGSIDE the plan — a created event NEVER feeds `buildSquadPlan` /
 * the set aggregation (it only lands on the group-events lane the timeline interleaves for display).
 */
import { useMemo, useState } from "react";
import { api } from "../../data/api";
import { stageColor, timeInZone } from "../../lib/format";
import { haptic } from "../../lib/haptics";
import { Sheet } from "../../ui/Sheet";
import { useT, type MessageKey } from "../../i18n";
import type { StageDto } from "../../data/types";

const DURATIONS: { id: string; min: number; key: MessageKey }[] = [
  { id: "30", min: 30, key: "event.dur30" },
  { id: "60", min: 60, key: "event.dur60" },
  { id: "90", min: 90, key: "event.dur90" },
  { id: "120", min: 120, key: "event.dur120" },
];

/** Seed the start at the next quarter-hour ~30 min out, formatted for a local `datetime-local` input. */
function defaultStartLocal(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateEventSheet({
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
  const t = useT();
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
    <Sheet onClose={onClose} label={t("event.newMoment")}>
      <div className="sheet-head">
        <div className="poster sheet-title">{t("event.newMoment")}</div>
        <button className="ms sheet-x" onClick={onClose}>close</button>
      </div>
      <div className="sheet-body">
        <label className="block-field">
          <span className="block-field-label">{t("event.what")}</span>
          <input
            className="block-input"
            value={title}
            maxLength={80}
            placeholder={t("event.whatPh")}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t("event.what")}
          />
        </label>

        <label className="block-field">
          <span className="block-field-label">{t("event.starts")}</span>
          <input
            className="block-input"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            aria-label={t("event.starts")}
          />
        </label>

        <div className="block-field">
          <span className="block-field-label">{t("event.forHowLong")}</span>
          <div className="event-durations">
            {DURATIONS.map((d) => (
              <button
                key={d.id}
                className={`chip${durationId === d.id ? " on" : ""}`}
                onClick={() => setDurationId(d.id)}
                aria-pressed={durationId === d.id}
              >
                {t(d.key)}
              </button>
            ))}
          </div>
          <span className="event-end-preview">{t("event.endsAround", { time: endPreview })}</span>
        </div>

        {stages.length > 0 && (
          <div className="block-field">
            <span className="block-field-label">{t("event.whereOptional")}</span>
            <div className="event-stages">
              <button className={`chip${stageId === null ? " on" : ""}`} onClick={() => setStageId(null)} aria-pressed={stageId === null}>
                {t("event.noStage")}
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
          <span className="block-field-label">{t("event.noteOptional")}</span>
          <input
            className="block-input"
            value={note}
            maxLength={280}
            placeholder={t("event.notePh")}
            onChange={(e) => setNote(e.target.value)}
            aria-label={t("event.noteOptional")}
          />
        </label>

        {error && (
          <p className="block-error">
            <span className="ms" style={{ fontSize: 14 }}>error</span> {t("event.createError")}
          </p>
        )}

        <button className="btn btn-primary" disabled={!valid || busy} onClick={() => void submit()}>
          <span className="ms">campaign</span>
          {busy ? t("event.sending") : t("event.send")}
        </button>
      </div>
    </Sheet>
  );
}
