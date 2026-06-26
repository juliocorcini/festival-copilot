/**
 * A7 My Plan (#21, DEC-018/029): the locked plan as a polished vertical timeline — done / now /
 * upcoming sets on a gradient rail, with walk chips between stages and break chips for long idles.
 * Reads the locally-saved plan (DEC-041); the timeline math is pure (`domain/plan.ts`). Empty days
 * route into Lock in. Share uses the Web Share API with a clipboard fallback.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { useOnboarding, usePlan } from "../data/localStore";
import { useLineup } from "../data/useLineup";
import { buildPlanTimeline, type PlanGapItem, type PlanSetItem } from "../domain/plan";
import { imageByActKey, nearbySets, toPlannableSets } from "../domain/lineup";
import { addToPlan, fittingAdds, fittingSwaps, removeFromPlan, swapInPlan } from "../domain/planEdit";
import { daysForWeekends, initials } from "../lib/festival";
import { stageColor, timeInZone } from "../lib/format";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { ErrorState, LoadingState } from "../ui/states";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";
import { SharePlanSheet } from "./share/SharePlanSheet";
import type { PlannableSet, PlanSlot } from "../domain/types";

export function MyPlanScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { onboarding } = useOnboarding();
  const travel = useTravelMatrix(lineup);
  const tz = lineup?.festival.timezone ?? "UTC";

  const [now, setNow] = useState(() => Date.now());
  const [showShare, setShowShare] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const allDays = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds) : []), [lineup, weekendIds]);
  const days = useMemo(() => {
    const picked = onboarding?.dayKeys ?? [];
    return picked.length > 0 ? allDays.filter((d) => picked.includes(d.key)) : allDays;
  }, [allDays, onboarding?.dayKeys]);

  const dayKey = params.get("day") ?? days[0]?.key ?? null;
  const day = days.find((d) => d.key === dayKey) ?? null;
  const plan = usePlan(lineup?.festival.id, dayKey ?? undefined);

  const timeline = useMemo(
    () => buildPlanTimeline(plan.plan?.slots ?? [], travel, now),
    [plan.plan?.slots, travel, now]
  );

  const photoByKey = useMemo(() => imageByActKey(lineup?.performances ?? []), [lineup]);

  const slots = useMemo(() => plan.plan?.slots ?? [], [plan.plan?.slots]);
  // Every set on this day (not just favorites) is a possible add/swap candidate; scoped to the
  // chosen weekend like Lock-in (DEC-048), so the picker offers exactly what plays that day.
  const daySets = useMemo<PlannableSet[]>(() => {
    if (!lineup || !dayKey) return [];
    return toPlannableSets(lineup.performances, lineup.stages).filter(
      (set) => set.day === dayKey && (weekendIds.length === 0 || !set.weekendId || weekendIds.includes(set.weekendId))
    );
  }, [lineup, dayKey, weekendIds]);

  const [menuFor, setMenuFor] = useState<PlanSlot | null>(null);
  const [swapFor, setSwapFor] = useState<PlanSlot | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) {
    return (
      <>
        <AppHeader eyebrow="Your day" title="My Plan" />
        <ErrorState message={error ?? "Could not load your plan."} onRetry={reload} />
      </>
    );
  }

  const title = day ? `${day.weekdayLong} ${dayOfMonth(day.startMs, tz)}` : "My Plan";
  const hasPlan = timeline.setCount > 0;
  const selectDay = (key: string): void => setParams(key ? { day: key } : {}, { replace: true });

  // Edits (R8): all keep the plan zero-overlap (planEdit) and persist locally (DEC-041).
  const removeSet = (setId: string): void => {
    plan.save(removeFromPlan(slots, setId));
    setMenuFor(null);
  };
  const swapSet = (oldSetId: string, set: PlannableSet): void => {
    const next = swapInPlan(slots, oldSetId, set);
    if (next) plan.save(next);
    setSwapFor(null);
    setMenuFor(null);
  };
  const addSet = (set: PlannableSet): void => {
    const next = addToPlan(slots, set);
    if (next) plan.save(next);
    setShowAdd(false);
  };

  return (
    <>
      <AppHeader
        eyebrow="My Plan"
        title={title}
        right={
          hasPlan ? (
            <button className="ava-sm" aria-label="Share plan" onClick={() => setShowShare(true)}>
              <span className="ms" style={{ color: "var(--accent)", fontSize: 19 }}>ios_share</span>
            </button>
          ) : undefined
        }
      />

      {days.length > 1 && (
        <div className="plan-days">
          {days.map((d) => (
            <button
              key={d.key}
              className={`pill${d.key === dayKey ? " on" : " ghost"}`}
              onClick={() => selectDay(d.key)}
            >
              {d.weekdayShort} {dayOfMonth(d.startMs, tz)}
            </button>
          ))}
          {hasPlan && (
            <span className="plan-summary">
              {timeline.setCount} set{timeline.setCount === 1 ? "" : "s"}
              {timeline.breakCount > 0 ? ` · ${timeline.breakCount} break${timeline.breakCount === 1 ? "" : "s"}` : ""}
            </span>
          )}
        </div>
      )}

      {!hasPlan ? (
        <div className="state">
          <span className="ms">event_available</span>
          <h2>No plan yet</h2>
          <p>Lock in your favorites and we’ll build a clash-free timeline for {day ? day.weekdayLong : "the day"}.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/lockin${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
          >
            <span className="ms">lock</span> Lock in my day
          </button>
        </div>
      ) : (
        <div className="plan-scroll">
          <div className="plan-tl">
            <div className="plan-tl-line" />
            {timeline.items.map((item, index) =>
              item.kind === "set" ? (
                <PlanSetRow
                  key={item.slot.setId}
                  item={item}
                  i={Math.min(index, 11)}
                  tz={tz}
                  photoUrl={photoByKey.get(item.slot.actKey) ?? null}
                  onMenu={() => setMenuFor(item.slot)}
                />
              ) : (
                <PlanGapRow key={`gap-${index}`} i={Math.min(index, 11)} item={item} onRoute={() => navigate(routeHref(dayKey))} />
              )
            )}
            <div className="plan-row">
              <span className="plan-dot mini" />
              <button className="plan-chip" onClick={() => setShowAdd(true)}>
                <span className="ms" style={{ fontSize: 14 }}>add</span> Add a set
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && hasPlan && plan.plan && (
        <SharePlanSheet
          festivalName={lineup.festival.name}
          dayName={title}
          slots={plan.plan.slots}
          timeZone={tz}
          onClose={() => setShowShare(false)}
        />
      )}

      {menuFor && (
        <PlanItemMenu
          slot={menuFor}
          tz={tz}
          onSwap={() => setSwapFor(menuFor)}
          onRemove={() => removeSet(menuFor.setId)}
          onMap={() => navigate(routeHref(dayKey))}
          onClose={() => setMenuFor(null)}
        />
      )}

      {swapFor && (
        <SetPickerSheet
          title={`Swap ${swapFor.label}`}
          hint="Only acts that fit this slot without creating a clash are shown."
          tz={tz}
          options={fittingSwaps(
            slots,
            swapFor.setId,
            nearbySets(lineup.performances, lineup.stages, swapWindow(swapFor), { dayKey })
          )}
          onPick={(set) => swapSet(swapFor.setId, set)}
          onClose={() => setSwapFor(null)}
        />
      )}

      {showAdd && (
        <SetPickerSheet
          title="Add a set"
          hint="Only acts that fit your day without overlapping a locked set are shown."
          tz={tz}
          options={fittingAdds(slots, daySets)}
          onPick={addSet}
          onClose={() => setShowAdd(false)}
        />
      )}
    </>
  );
}

/** [start, effective end) of a slot — the window we look for swap candidates around. */
function swapWindow(slot: PlanSlot): { startMs: number; endMs: number } {
  const end = slot.cutMs != null && slot.cutMs > slot.startMs && slot.cutMs < slot.endMs ? slot.cutMs : slot.endMs;
  return { startMs: slot.startMs, endMs: end };
}

function PlanItemMenu({
  slot,
  tz,
  onSwap,
  onRemove,
  onMap,
  onClose,
}: {
  slot: PlanSlot;
  tz: string;
  onSwap: () => void;
  onRemove: () => void;
  onMap: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">{slot.label}</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="plan-menu-meta">
          <span className="dot" style={{ background: stageColor(slot.stageName) }} />
          {slot.stageName} · {timeInZone(new Date(slot.startMs).toISOString(), tz)}
        </div>
        <div className="sheet-body">
          <button className="plan-menu-item" onClick={onMap}>
            <span className="ms">map</span> View on map
          </button>
          <button className="plan-menu-item" onClick={onSwap}>
            <span className="ms">swap_horiz</span> Swap set
          </button>
          <button className="plan-menu-item danger" onClick={onRemove}>
            <span className="ms">delete</span> Remove from plan
          </button>
        </div>
      </div>
    </>
  );
}

function SetPickerSheet({
  title,
  hint,
  tz,
  options,
  onPick,
  onClose,
}: {
  title: string;
  hint: string;
  tz: string;
  options: PlannableSet[];
  onPick: (set: PlannableSet) => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? options.filter((set) => set.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">{title}</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="search">
          <span className="ms" style={{ color: "var(--muted)", fontSize: 20 }}>search</span>
          <input placeholder="Search artists…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search artists" />
        </div>
        <div className="sheet-body">
          {filtered.length === 0 ? (
            <p className="lk-note">No acts fit here without a clash.</p>
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
                <button className="addpill" onClick={() => onPick(set)}>{title.startsWith("Swap") ? "Swap" : "Add"}</button>
              </div>
            ))
          )}
          <p className="lk-note">{hint}</p>
        </div>
      </div>
    </>
  );
}

function PlanSetRow({
  item,
  i,
  tz,
  photoUrl,
  onMenu,
}: {
  item: PlanSetItem;
  i: number;
  tz: string;
  photoUrl: string | null;
  onMenu: () => void;
}): JSX.Element {
  const { openArtist } = useArtistSheet();
  const { slot, status, endMs } = item;
  const start = timeInZone(new Date(slot.startMs).toISOString(), tz);
  const end = timeInZone(new Date(endMs).toISOString(), tz);
  const color = stageColor(slot.stageName);
  // The card body opens the Artist Detail Sheet (ART-6); editing (swap/remove/map) moves to the
  // explicit `more_vert` button so the two actions never collide. stopPropagation keeps the edit
  // tap from also opening the sheet.
  return (
    <div className="plan-row fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className={`plan-dot ${status}`} />
      <div
        className={`glass plan-card tappable ${status}`}
        role="button"
        tabIndex={0}
        aria-label={`View ${slot.label}`}
        onClick={() => openArtist(slot.actKey)}
        onKeyDown={openOnActivate(() => openArtist(slot.actKey))}
      >
        <ArtistPhoto src={photoUrl} name={slot.label} width={PHOTO_WIDTH.list} className="plan-photo" />
        <div className="plan-card-main">
          <div className={`plan-when ${status}`}>
            {status === "now" ? "NOW · " : ""}
            {start} – {end}
            {status === "done" ? " · done" : ""}
            {slot.cutMs != null ? " · left early" : ""}
          </div>
          <div className="poster plan-name">{slot.label}</div>
          <div className="plan-stage">
            <span className="dot" style={{ background: color }} />
            {slot.stageName}
          </div>
        </div>
        <button
          type="button"
          className="plan-state-ico-btn"
          aria-label={`Edit ${slot.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onMenu();
          }}
        >
          <span className="ms plan-state-ico" aria-hidden="true">more_vert</span>
        </button>
      </div>
    </div>
  );
}

function PlanGapRow({ item, i, onRoute }: { item: PlanGapItem; i: number; onRoute: () => void }): JSX.Element {
  return (
    <div className="plan-row gap fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className="plan-dot mini" />
      <div className="plan-chips">
        {item.walkMinutes > 0 && (
          <button type="button" className="plan-chip" onClick={onRoute}>
            <span className="ms" style={{ fontSize: 13 }}>directions_walk</span>
            {item.walkMinutes} min walk to {item.toStageName}
          </button>
        )}
        {item.breakMinutes >= 20 && (
          <span className="plan-chip">
            <span className="ms" style={{ fontSize: 13 }}>restaurant</span>
            {item.breakMinutes} min break
          </span>
        )}
      </div>
    </div>
  );
}

function dayOfMonth(startMs: number, timeZone: string): string {
  if (!Number.isFinite(startMs)) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone }).format(startMs);
}

function routeHref(dayKey: string | null): string {
  return `/route${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`;
}
