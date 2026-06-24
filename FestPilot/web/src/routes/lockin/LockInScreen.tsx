/**
 * A5 Lock in (#12c) + A6 celebration (#13). Drives the gated, one-at-a-time clash resolver
 * (DEC-017/029) over the day's favorites: pick one of the clashing sets, optionally add a nearby
 * act or leave a set early (partial set, DEC-018), and watch the progress fill. When every clash is
 * resolved the plan is persisted locally (DEC-041) and the celebration screen offers My Plan / Share.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useFavorites, useOnboarding, usePlan } from "../../data/localStore";
import { useLineup } from "../../data/useLineup";
import { favoriteSets, nearbySets } from "../../domain/lineup";
import { flatTravelMatrix, latestFeasibleDeparture } from "../../domain/partialSet";
import {
  pickOption,
  pickSet,
  previewRemainingClashes,
  startResolver,
  type ResolverSnapshot,
} from "../../domain/resolver";
import type { PlannableSet, PlanSlot } from "../../domain/types";
import { daysForWeekends, initials } from "../../lib/festival";
import { dayLabel, stageColor, timeInZone } from "../../lib/format";
import { sharePlan } from "../../lib/share";
import { EmptyState, ErrorState, LoadingState } from "../../ui/states";

const TRAVEL = flatTravelMatrix(8);

export function LockInScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { onboarding } = useOnboarding();
  const favorites = useFavorites(lineup?.festival.id);
  const tz = lineup?.festival.timezone ?? "UTC";

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const fallbackDay = useMemo(
    () => (lineup ? daysForWeekends(lineup, weekendIds)[0]?.key ?? null : null),
    [lineup, weekendIds]
  );
  const dayKey = params.get("day") ?? onboarding?.dayKeys?.[0] ?? fallbackDay;
  const plan = usePlan(lineup?.festival.id, dayKey ?? undefined);

  const [snapshot, setSnapshot] = useState<ResolverSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [added, setAdded] = useState<PlannableSet[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showClashes, setShowClashes] = useState(false);
  const startedFor = useRef<string | null>(null);
  const savedFor = useRef<string | null>(null);

  // Start the resolver once per day, from a snapshot of the day's favorites (later "add" actions
  // mutate the favorites store but must NOT silently restart an in-progress resolution).
  useEffect(() => {
    if (!lineup || !dayKey || startedFor.current === dayKey) return;
    const dayFavorites = favoriteSets(lineup.performances, lineup.stages, favorites.keys).filter(
      (set) => set.day === dayKey && (weekendIds.length === 0 || !set.weekendId || weekendIds.includes(set.weekendId))
    );
    startedFor.current = dayKey;
    setSnapshot(startResolver(dayFavorites));
    setAdded([]);
    setSelectedId(null);
    // favorites.keys read intentionally fresh (not a dep) so adds don't restart the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup, dayKey, weekendIds]);

  const decisionIndex = snapshot?.decision?.index ?? -1;
  useEffect(() => {
    setSelectedId(null);
    setAdded([]);
  }, [decisionIndex]);

  // Persist the resolved plan once it completes.
  useEffect(() => {
    if (!snapshot || snapshot.decision || !dayKey) return;
    if (savedFor.current === dayKey) return;
    if (snapshot.locked.length === 0) return;
    savedFor.current = dayKey;
    plan.save(snapshot.locked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, dayKey]);

  if (status === "loading" || !snapshot) return <LoadingState />;
  if (status === "error" || !lineup) {
    return <ErrorState message={error ?? "Could not load the lineup."} onRetry={reload} />;
  }

  const dayName = snapshot.locked[0]
    ? dayLabel(new Date(snapshot.locked[0].startMs).toISOString(), tz)
    : dayKey ?? "Your day";

  // ── Resolution complete ──
  if (!snapshot.decision && snapshot.locked.length === 0) {
    return (
      <div className="lockin">
        <div className="lk-bar">
          <span />
          <button className="lk-close" aria-label="Close" onClick={() => navigate(-1)}>
            <span className="ms" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <EmptyState
          icon="favorite"
          title="No favorites yet"
          message="Heart a few acts in the Timetable or Lineup, then lock in a clash-free day."
        />
      </div>
    );
  }

  if (!snapshot.decision) {
    return (
      <Celebration
        slots={snapshot.locked}
        dayName={dayName}
        tz={tz}
        onView={() => navigate(`/plan${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`, { replace: true })}
        onShare={() => sharePlan(dayName, snapshot.locked, tz)}
      />
    );
  }

  const decision = snapshot.decision;
  const optionKeys = new Set([...decision.options.map((o) => o.actKey), ...added.map((a) => a.actKey)]);
  const options = [...decision.options, ...added];
  const selected = options.find((o) => o.id === selectedId) ?? options[0] ?? null;
  const progressPct = snapshot.decisionsTotal > 0 ? (snapshot.decisionsResolved / snapshot.decisionsTotal) * 100 : 100;
  const split = selected ? feasibleSplit(selected, options) : null;

  const lockIn = (cutMs: number | null = null): void => {
    if (!selected) return;
    const next = decision.options.some((o) => o.id === selected.id)
      ? pickOption(snapshot, selected.id, cutMs)
      : pickSet(snapshot, selected, cutMs);
    setSnapshot(next);
  };

  const addNearby = (set: PlannableSet): void => {
    favorites.toggle(set.actKey); // persist so it stays a favorite across the plan
    setAdded((prev) => (prev.some((p) => p.id === set.id) ? prev : [...prev, set]));
    setSelectedId(set.id);
    setShowAdd(false);
  };

  const nearby = nearbySets(
    lineup.performances,
    lineup.stages,
    { startMs: decision.startMs, endMs: decision.endMs },
    { excludeActKeys: optionKeys, dayKey }
  );

  return (
    <div className="lockin">
      <div className="lk-bar">
        <button className="lk-link" onClick={() => setShowClashes(true)}>
          <span className="ms" style={{ fontSize: 16 }}>list</span> All clashes
        </button>
        <button className="lk-close" aria-label="Close" onClick={() => navigate(-1)}>
          <span className="ms" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>

      <div className="lk-progress">
        <div className="lk-progress-head">
          <span>LOCK IN</span>
          <span>
            {snapshot.decisionsResolved + 1} of {Math.max(snapshot.decisionsTotal, snapshot.decisionsResolved + 1)} time slots
          </span>
        </div>
        <div className="progress-pill">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="lk-clash-head">
        <div className="poster lk-window">
          {dayLabel(new Date(decision.startMs).toISOString(), tz)} · {timeInZone(new Date(decision.startMs).toISOString(), tz)} – {timeInZone(new Date(decision.endMs).toISOString(), tz)}
        </div>
        <div className="lk-clash-title">{options.length} favorites clash — pick one</div>
      </div>

      <div className="lk-options">
        {options.map((opt) => {
          const isSel = selected?.id === opt.id;
          return (
            <button key={opt.id} className={`glass pick${isSel ? " sel" : ""}`} onClick={() => setSelectedId(opt.id)}>
              <div className="lk-ava" style={{ color: stageColor(opt.stageName) }}>{initials(opt.label)}</div>
              <div className="lk-opt-main">
                <div className="poster lk-opt-name">{opt.label}</div>
                <div className="lk-opt-meta">
                  <span className="dot" style={{ background: stageColor(opt.stageName) }} />
                  {opt.stageName} · {timeInZone(new Date(opt.startMs).toISOString(), tz)}
                </div>
              </div>
              <span className="ms lk-selico" style={{ color: isSel ? "var(--accent)" : "var(--muted)" }}>
                {isSel ? "check_circle" : "radio_button_unchecked"}
              </span>
            </button>
          );
        })}

        <button className="add-btn" onClick={() => setShowAdd(true)}>
          <span className="ms" style={{ fontSize: 18 }}>add</span> Add another artist around this time
        </button>
      </div>

      <div className="lk-foot">
        <button className="btn btn-primary lk-lock" onClick={() => lockIn(null)} disabled={!selected}>
          {selected ? `Lock in ${selected.label}` : "Pick one"}
        </button>
        <button
          className="lk-cut"
          aria-label="See part of this set, then leave early"
          title={split ? `See ${selected?.label} then catch ${split.target.label}` : "No early-leave fits here"}
          disabled={!split}
          onClick={() => split && lockIn(split.cutMs)}
        >
          <span className="ms" style={{ fontSize: 16 }}>content_cut</span>
        </button>
      </div>

      {showClashes && (
        <ClashesSheet snapshot={snapshot} tz={tz} onClose={() => setShowClashes(false)} />
      )}
      {showAdd && (
        <AddSheet
          window={{ startMs: decision.startMs, endMs: decision.endMs }}
          tz={tz}
          nearby={nearby}
          onAdd={addNearby}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

interface Split {
  target: PlannableSet;
  cutMs: number;
}

/** The earliest reachable later option you could catch by leaving the selected set early (DEC-018). */
function feasibleSplit(selected: PlannableSet, options: PlannableSet[]): Split | null {
  const from = asSlot(selected);
  let best: Split | null = null;
  for (const candidate of options) {
    if (candidate.id === selected.id || candidate.startMs <= selected.startMs) continue;
    const cutMs = latestFeasibleDeparture(from, asSlot(candidate), TRAVEL);
    if (cutMs == null || cutMs <= selected.startMs) continue;
    if (!best || candidate.startMs < best.target.startMs) best = { target: candidate, cutMs };
  }
  return best;
}

function asSlot(set: PlannableSet): PlanSlot {
  return {
    setId: set.id,
    actKey: set.actKey,
    label: set.label,
    stageId: set.stageId,
    stageName: set.stageName,
    startMs: set.startMs,
    endMs: set.endMs,
    cutMs: null,
  };
}

function Celebration({
  slots,
  dayName,
  tz,
  onView,
  onShare,
}: {
  slots: PlanSlot[];
  dayName: string;
  tz: string;
  onView: () => void;
  onShare: () => void;
}): JSX.Element {
  return (
    <div className="celebrate">
      <div className="glow-ring">
        <div className="inner">
          <span className="ms" style={{ fontSize: 56, color: "var(--accent)" }}>check</span>
        </div>
      </div>
      <div className="poster celebrate-title">LOCKED IN!</div>
      <div className="celebrate-sub">
        Your plan is set. {slots.length} artist{slots.length === 1 ? "" : "s"}, 0 conflicts.
      </div>

      <div className="glass celebrate-card">
        <div className="label">{dayName}</div>
        <div className="celebrate-list">
          {slots.map((slot) => (
            <div key={slot.setId} className="celebrate-row">
              <span className="dot" style={{ background: stageColor(slot.stageName) }} />
              <span className="n">{slot.label}</span>
              <span className="t">{timeInZone(new Date(slot.startMs).toISOString(), tz)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="celebrate-actions">
        <button className="btn btn-primary" onClick={onView}>View My Plan</button>
        <button className="btn btn-ghost" onClick={onShare}>Share</button>
      </div>
    </div>
  );
}

function ClashesSheet({
  snapshot,
  tz,
  onClose,
}: {
  snapshot: ResolverSnapshot;
  tz: string;
  onClose: () => void;
}): JSX.Element {
  const windows = previewRemainingClashes(snapshot);
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">All clashes</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="sheet-body">
          {windows.length === 0 ? (
            <p className="lk-note">No clashes left — you're all set.</p>
          ) : (
            windows.map((w, i) => (
              <div key={`${w.startMs}-${i}`} className="row">
                <div className="lk-ava" style={{ color: i === 0 ? "var(--accent)" : "var(--muted)" }}>{i + 1}</div>
                <div className="min0">
                  <div className="lk-clash-row-title">
                    {timeInZone(new Date(w.startMs).toISOString(), tz)} – {timeInZone(new Date(w.endMs).toISOString(), tz)}
                  </div>
                  <div className="lk-opt-meta">{w.optionCount} favorites overlap{i === 0 ? " · resolving now" : ""}</div>
                </div>
              </div>
            ))
          )}
          <p className="lk-note">This is a preview — picking a longer set can absorb a later clash.</p>
        </div>
      </div>
    </>
  );
}

function AddSheet({
  window,
  tz,
  nearby,
  onAdd,
  onClose,
}: {
  window: { startMs: number; endMs: number };
  tz: string;
  nearby: PlannableSet[];
  onAdd: (set: PlannableSet) => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? nearby.filter((set) => set.label.toLowerCase().includes(query.trim().toLowerCase()))
    : nearby;
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">Add an artist</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="win-tag">
          Playing around <b>{timeInZone(new Date(window.startMs).toISOString(), tz)} – {timeInZone(new Date(window.endMs).toISOString(), tz)}</b>
        </div>
        <div className="search">
          <span className="ms" style={{ color: "var(--muted)", fontSize: 20 }}>search</span>
          <input placeholder="Search any artist…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="sheet-body">
          <div className="sheet-section">NEARBY THIS TIME</div>
          {filtered.length === 0 ? (
            <p className="lk-note">No other acts around this slot.</p>
          ) : (
            filtered.map((set) => (
              <div key={set.id} className="row">
                <div className="lk-ava" style={{ color: stageColor(set.stageName) }}>{initials(set.label)}</div>
                <div className="min0">
                  <div className="lk-add-name">{set.label}</div>
                  <div className="lk-opt-meta">
                    <span className="dot" style={{ background: stageColor(set.stageName) }} />
                    {set.stageName} · {timeInZone(new Date(set.startMs).toISOString(), tz)} – {timeInZone(new Date(set.endMs).toISOString(), tz)}
                  </div>
                </div>
                <button className="addpill" onClick={() => onAdd(set)}>Add</button>
              </div>
            ))
          )}
          <p className="lk-note">Only acts playing near this slot are shown — so the choice still makes sense.</p>
        </div>
      </div>
    </>
  );
}
