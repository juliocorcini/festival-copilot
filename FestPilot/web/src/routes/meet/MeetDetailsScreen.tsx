/**
 * Set a meeting point — details (B4.2 / proto #26.2, UC-27). Name it, choose WHEN to meet (now / a
 * short offset), confirm WHO (the whole squad in V1 — DEC-047), add an optional note, then notify
 * everyone. The exact spot was chosen on B4.1 and arrives via router state. Photo deferred (DEC-047).
 */
import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import type { PickedSpot } from "./MeetSpotScreen";

interface WhenOption {
  id: string;
  label: string;
  /** Minutes from now; 0 = meet now (no scheduled time). */
  offsetMin: number;
}

const WHEN_OPTIONS: WhenOption[] = [
  { id: "now", label: "Now", offsetMin: 0 },
  { id: "15", label: "In 15 min", offsetMin: 15 },
  { id: "30", label: "In 30 min", offsetMin: 30 },
  { id: "60", label: "In 1 hour", offsetMin: 60 },
];

export function MeetDetailsScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation();
  const spot = state as PickedSpot | null;
  const { group } = useGroup(id);

  const [name, setName] = useState("");
  const [whenId, setWhenId] = useState("now");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const meetAtUtc = useMemo(() => {
    const opt = WHEN_OPTIONS.find((o) => o.id === whenId);
    if (!opt || opt.offsetMin === 0) return null;
    return new Date(Date.now() + opt.offsetMin * 60_000).toISOString();
  }, [whenId]);

  // The spot is required — a deep link without it goes back to the picker.
  if (!spot || !id) return <Navigate to={`/squad/${id ?? ""}/meet`} replace />;

  const send = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await api.createMeetingPoint(id, {
        lat: spot.lat,
        lng: spot.lng,
        accuracyMeters: spot.accuracyMeters,
        title: name.trim() || `Meet ${spot.label}`,
        note: note.trim() || null,
        meetAtUtc,
      });
      navigate("/squad", { replace: true });
    } catch {
      setBusy(false);
      setError(true);
    }
  };

  const squadLabel = group ? `${group.emoji ? `${group.emoji} ` : ""}${group.name} · ${group.memberCount}` : "Your squad";

  return (
    <>
      <StackHeader title="Meeting point" />
      <div className="screen meet-details">
        <button className="glass meet-spot-summary" onClick={() => navigate(`/squad/${id}/meet`)}>
          <span className="ms" style={{ color: "var(--accent)" }}>place</span>
          <div className="meet-spot-summary-main">
            <div className="meet-spot-summary-title">{spot.label}</div>
            <div className="meet-spot-summary-sub">Exact spot · shared with your squad</div>
          </div>
          <span className="pill">Edit</span>
        </button>

        <div className="meet-field-group">
          <div className="label">Name it</div>
          <input
            className="field"
            value={name}
            maxLength={60}
            placeholder="Regroup at the bar 🍻"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="meet-field-group">
          <div className="label">When</div>
          <div className="meet-when">
            {WHEN_OPTIONS.map((o) => (
              <button key={o.id} className={`chip${whenId === o.id ? " on" : ""}`} onClick={() => setWhenId(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="meet-field-group">
          <div className="label">Who</div>
          <div className="glass meet-who">
            <span className="ms">groups</span>
            <div className="meet-who-main">Whole squad · {squadLabel}</div>
            <span className="ms" style={{ color: "var(--accent)" }}>check_circle</span>
          </div>
        </div>

        <div className="meet-field-group">
          <div className="label">
            Note <span style={{ color: "var(--muted)", textTransform: "none", fontWeight: 500 }}>(optional)</span>
          </div>
          <input
            className="field"
            value={note}
            maxLength={280}
            placeholder="I'll grab a round 🍻"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <div className="meet-error">Couldn't send that — check your connection and try again.</div>}
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={send} disabled={busy}>
          <span className="ms">campaign</span>
          {busy ? "Sending…" : "Send to squad"}
        </button>
      </div>
    </>
  );
}
