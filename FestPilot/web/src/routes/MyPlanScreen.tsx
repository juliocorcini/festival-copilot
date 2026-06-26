/**
 * A7 My Plan (#21, DEC-018/029/073/074): the locked plan as a polished vertical timeline — done / now /
 * upcoming sets on a gradient rail, with walk chips between stages, break chips for long idles, and
 * personal blocks (eat/rest/meet/…) the user slots into the day. An "Edit" toggle reveals the extra
 * controls: fill a gap with a block, fine-tune a block, and choose how to absorb a tight walk between
 * sets (leave the current one early, or arrive at the next late). The timeline math is pure
 * (`domain/plan.ts`); blocks + travel choices persist locally (DEC-041) and never reach the squad.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { useOnboarding, usePlan } from "../data/localStore";
import { useTravelPref } from "../app/settings";
import { useLineup } from "../data/useLineup";
import {
  buildPlanTimeline,
  FILLABLE_THRESHOLD_MIN,
  type PlanBlockItem,
  type PlanGapItem,
  type PlanItem,
  type PlanSetItem,
} from "../domain/plan";
import { imageByActKey, nearbySets, toPlannableSets } from "../domain/lineup";
import {
  addBlock,
  addToPlan,
  applyArriveLate,
  applyLeaveEarly,
  clearTravelChoice,
  editBlockMeta,
  fittingAdds,
  fittingSwaps,
  rangeIsFree,
  removeBlock,
  removeFromPlan,
  resizeBlock,
  swapInPlan,
} from "../domain/planEdit";
import { effectiveEnd } from "../domain/planSlot";
import { daysForWeekends, initials } from "../lib/festival";
import { stageColor, timeInZone } from "../lib/format";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { ErrorState, LoadingState } from "../ui/states";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";
import { SharePlanSheet } from "./share/SharePlanSheet";
import type { PlanBlock, PlanBlockKind, PlannableSet, PlanSlot } from "../domain/types";

const MIN = 60_000;
const STEP_MS = 15 * MIN;

const BLOCK_KINDS: Record<PlanBlockKind, { icon: string; label: string }> = {
  eat: { icon: "restaurant", label: "Food" },
  rest: { icon: "airline_seat_flat", label: "Rest" },
  water: { icon: "local_drink", label: "Water" },
  meet: { icon: "group", label: "Meet up" },
  explore: { icon: "explore", label: "Explore" },
  custom: { icon: "more_horiz", label: "Plan" },
};
const PRESET_ORDER: PlanBlockKind[] = ["eat", "rest", "water", "meet", "explore", "custom"];

interface BlockDraft {
  id: string | null;
  kind: PlanBlockKind;
  label: string;
  startMs: number;
  endMs: number;
  note: string;
}

export function MyPlanScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { onboarding } = useOnboarding();
  const travel = useTravelMatrix(lineup);
  const { travelPref } = useTravelPref();
  const tz = lineup?.festival.timezone ?? "UTC";

  const [now, setNow] = useState(() => Date.now());
  const [showShare, setShowShare] = useState(false);
  const [editing, setEditing] = useState(() => params.get("edit") === "1");
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

  const slots = useMemo(() => plan.plan?.slots ?? [], [plan.plan?.slots]);
  const blocks = useMemo(() => plan.plan?.blocks ?? [], [plan.plan?.blocks]);

  const timeline = useMemo(
    () => buildPlanTimeline(slots, blocks, travel, now, travelPref),
    [slots, blocks, travel, now, travelPref]
  );

  const photoByKey = useMemo(() => imageByActKey(lineup?.performances ?? []), [lineup]);

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
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [travelFor, setTravelFor] = useState<PlanSetItem | null>(null);

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

  // Personal blocks (DEC-073) — open the editor pre-filled (from a gap, or a sensible free window).
  const fillGap = (gap: PlanGapItem): void => {
    const kind: PlanBlockKind = "eat";
    setBlockDraft({ id: null, kind, label: BLOCK_KINDS[kind].label, startMs: gap.fillStartMs, endMs: gap.fillEndMs, note: "" });
  };
  const addBreak = (): void => {
    const window = firstFreeWindow(timeline.items);
    const kind: PlanBlockKind = "eat";
    setBlockDraft({ id: null, kind, label: BLOCK_KINDS[kind].label, startMs: window.startMs, endMs: window.endMs, note: "" });
  };
  const editBlock = (block: PlanBlock): void => {
    setBlockDraft({ id: block.id, kind: block.kind, label: block.label, startMs: block.startMs, endMs: block.endMs, note: block.note ?? "" });
  };
  const commitBlock = (draft: BlockDraft): void => {
    const label = draft.label.trim() || BLOCK_KINDS[draft.kind].label;
    if (draft.id) {
      const resized = resizeBlock(slots, blocks, draft.id, draft.startMs, draft.endMs);
      if (!resized) return;
      plan.saveBlocks(editBlockMeta(resized, draft.id, { kind: draft.kind, label, note: draft.note.trim() || undefined }));
    } else {
      const block: PlanBlock = {
        id: cryptoId(),
        kind: draft.kind,
        label,
        startMs: draft.startMs,
        endMs: draft.endMs,
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      };
      const next = addBlock(slots, blocks, block);
      if (!next) return;
      plan.saveBlocks(next);
    }
    setBlockDraft(null);
  };
  const deleteBlock = (id: string): void => {
    plan.saveBlocks(removeBlock(blocks, id));
    setBlockDraft(null);
  };

  // Travel choice (DEC-074) — both options only shrink an effective interval, so they stay zero-overlap.
  const resolveTravel = (item: PlanSetItem, choice: "leave-early" | "arrive-late" | "clear"): void => {
    const info = item.travelIn;
    if (!info) return;
    const prev = slots.find((s) => s.setId === info.fromSetId);
    if (!prev) return;
    const walkMs = info.walkMinutes * MIN;
    let next = slots;
    if (choice === "leave-early") next = applyLeaveEarly(slots, prev.setId, item.slot.setId, item.slot.startMs - walkMs);
    else if (choice === "arrive-late") next = applyArriveLate(slots, prev.setId, item.slot.setId, prev.endMs + walkMs);
    else next = clearTravelChoice(slots, prev.setId, item.slot.setId);
    plan.save(next);
    setTravelFor(null);
  };

  return (
    <>
      <AppHeader
        eyebrow="My Plan"
        title={title}
        right={
          hasPlan ? (
            <div className="plan-actions">
              <button
                className={`plan-edit-btn${editing ? " on" : ""}`}
                aria-pressed={editing}
                data-haptic="light"
                onClick={() => setEditing((v) => !v)}
              >
                <span className="ms" style={{ fontSize: 16 }}>{editing ? "check" : "edit"}</span>
                {editing ? "Done" : "Edit"}
              </button>
              <button className="ava-sm" aria-label="Share plan" onClick={() => setShowShare(true)}>
                <span className="ms" style={{ color: "var(--accent)", fontSize: 19 }}>ios_share</span>
              </button>
            </div>
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
              {timeline.blockCount > 0 ? ` · ${timeline.blockCount} plan${timeline.blockCount === 1 ? "" : "s"}` : ""}
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
            {timeline.items.map((item, index) => {
              const i = Math.min(index, 11);
              if (item.kind === "set") {
                return (
                  <PlanSetRow
                    key={item.slot.setId}
                    item={item}
                    i={i}
                    tz={tz}
                    editing={editing}
                    photoUrl={photoByKey.get(item.slot.actKey) ?? null}
                    onMenu={() => setMenuFor(item.slot)}
                    onTravel={() => setTravelFor(item)}
                  />
                );
              }
              if (item.kind === "block") {
                return <PlanBlockRow key={item.block.id} item={item} i={i} tz={tz} editing={editing} onEdit={() => editBlock(item.block)} />;
              }
              return (
                <PlanGapRow
                  key={`gap-${index}`}
                  i={i}
                  item={item}
                  editing={editing}
                  onRoute={() => navigate(routeHref(dayKey))}
                  onFill={() => fillGap(item)}
                />
              );
            })}
            <div className="plan-row">
              <span className="plan-dot mini" />
              <div className="plan-add-row">
                <button className="plan-chip" onClick={() => setShowAdd(true)}>
                  <span className="ms" style={{ fontSize: 14 }}>add</span> Add a set
                </button>
                {editing && (
                  <button className="plan-chip" onClick={addBreak}>
                    <span className="ms" style={{ fontSize: 14 }}>more_time</span> Add a break
                  </button>
                )}
              </div>
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

      {blockDraft && (
        <BlockSheet
          draft={blockDraft}
          slots={slots}
          blocks={blocks}
          tz={tz}
          onChange={setBlockDraft}
          onCommit={commitBlock}
          onDelete={blockDraft.id ? () => deleteBlock(blockDraft.id!) : undefined}
          onClose={() => setBlockDraft(null)}
        />
      )}

      {travelFor && (
        <TravelSheet
          item={travelFor}
          slots={slots}
          tz={tz}
          onLeaveEarly={() => resolveTravel(travelFor, "leave-early")}
          onArriveLate={() => resolveTravel(travelFor, "arrive-late")}
          onClear={() => resolveTravel(travelFor, "clear")}
          onClose={() => setTravelFor(null)}
        />
      )}
    </>
  );
}

/** [start, effective end) of a slot — the window we look for swap candidates around. */
function swapWindow(slot: PlanSlot): { startMs: number; endMs: number } {
  return { startMs: slot.startMs, endMs: effectiveEnd(slot) };
}

/** The first comfortably-fillable gap, else a free hour after the last set, for a fresh block. */
function firstFreeWindow(items: PlanItem[]): { startMs: number; endMs: number } {
  for (const item of items) {
    if (item.kind === "gap" && item.freeMinutes >= FILLABLE_THRESHOLD_MIN) {
      return { startMs: item.fillStartMs, endMs: item.fillEndMs };
    }
  }
  const sets = items.filter((i): i is PlanSetItem => i.kind === "set");
  const last = sets[sets.length - 1];
  const base = last ? last.endMs : Date.now();
  return { startMs: base, endMs: base + 60 * MIN };
}

function cryptoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
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

/** Create/edit a personal block: preset, label, 15-min time steppers, optional note. */
function BlockSheet({
  draft,
  slots,
  blocks,
  tz,
  onChange,
  onCommit,
  onDelete,
  onClose,
}: {
  draft: BlockDraft;
  slots: PlanSlot[];
  blocks: PlanBlock[];
  tz: string;
  onChange: (draft: BlockDraft) => void;
  onCommit: (draft: BlockDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}): JSX.Element {
  const valid = rangeIsFree(slots, blocks, { startMs: draft.startMs, endMs: draft.endMs }, draft.id ?? undefined);
  const durationMin = Math.max(0, Math.round((draft.endMs - draft.startMs) / MIN));
  const pickKind = (kind: PlanBlockKind): void => {
    const wasDefault = draft.label.trim() === "" || PRESET_ORDER.some((k) => BLOCK_KINDS[k].label === draft.label.trim());
    onChange({ ...draft, kind, label: wasDefault ? BLOCK_KINDS[kind].label : draft.label });
  };
  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">{draft.id ? "Edit plan" : "Add to your day"}</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="sheet-body">
          <div className="block-presets">
            {PRESET_ORDER.map((kind) => (
              <button
                key={kind}
                className={`block-preset${draft.kind === kind ? " on" : ""}`}
                onClick={() => pickKind(kind)}
                aria-pressed={draft.kind === kind}
              >
                <span className="ms" aria-hidden="true">{BLOCK_KINDS[kind].icon}</span>
                {BLOCK_KINDS[kind].label}
              </button>
            ))}
          </div>

          <label className="block-field">
            <span className="block-field-label">Label</span>
            <input
              className="block-input"
              value={draft.label}
              placeholder={BLOCK_KINDS[draft.kind].label}
              onChange={(e) => onChange({ ...draft, label: e.target.value })}
              aria-label="Block label"
            />
          </label>

          <div className="block-times">
            <TimeStepper
              label="From"
              valueMs={draft.startMs}
              tz={tz}
              onChange={(startMs) => onChange({ ...draft, startMs, endMs: Math.max(draft.endMs, startMs + STEP_MS) })}
            />
            <TimeStepper
              label="To"
              valueMs={draft.endMs}
              tz={tz}
              min={draft.startMs + STEP_MS}
              onChange={(endMs) => onChange({ ...draft, endMs })}
            />
            <span className="block-duration">{durationMin} min</span>
          </div>

          <label className="block-field">
            <span className="block-field-label">Note (optional)</span>
            <input
              className="block-input"
              value={draft.note}
              placeholder="e.g. north gate, with Ana"
              onChange={(e) => onChange({ ...draft, note: e.target.value })}
              aria-label="Block note"
            />
          </label>

          {!valid && <p className="block-error"><span className="ms" style={{ fontSize: 14 }}>error</span> That time overlaps a set or another plan.</p>}

          <button className="btn btn-primary" disabled={!valid} onClick={() => onCommit(draft)}>
            <span className="ms">{draft.id ? "check" : "add"}</span> {draft.id ? "Save" : "Add to plan"}
          </button>
          {onDelete && (
            <button className="plan-menu-item danger" onClick={onDelete}>
              <span className="ms">delete</span> Remove from plan
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function TimeStepper({
  label,
  valueMs,
  tz,
  min,
  onChange,
}: {
  label: string;
  valueMs: number;
  tz: string;
  min?: number;
  onChange: (ms: number) => void;
}): JSX.Element {
  const dec = (): void => {
    const next = valueMs - STEP_MS;
    if (min == null || next >= min) onChange(next);
  };
  return (
    <div className="time-stepper">
      <span className="time-stepper-label">{label}</span>
      <div className="time-stepper-ctrl">
        <button className="time-stepper-btn" aria-label={`${label} earlier`} onClick={dec}>
          <span className="ms" style={{ fontSize: 18 }}>remove</span>
        </button>
        <span className="time-stepper-val">{timeInZone(new Date(valueMs).toISOString(), tz)}</span>
        <button className="time-stepper-btn" aria-label={`${label} later`} onClick={() => onChange(valueMs + STEP_MS)}>
          <span className="ms" style={{ fontSize: 18 }}>add</span>
        </button>
      </div>
    </div>
  );
}

/** Choose how to absorb a tight walk into a set: leave the previous early, or arrive at this one late. */
function TravelSheet({
  item,
  slots,
  tz,
  onLeaveEarly,
  onArriveLate,
  onClear,
  onClose,
}: {
  item: PlanSetItem;
  slots: PlanSlot[];
  tz: string;
  onLeaveEarly: () => void;
  onArriveLate: () => void;
  onClear: () => void;
  onClose: () => void;
}): JSX.Element {
  const info = item.travelIn!;
  const prev = slots.find((s) => s.setId === info.fromSetId);
  const walkMs = info.walkMinutes * MIN;
  const lost = prev ? Math.max(0, Math.round((prev.endMs + walkMs - item.slot.startMs) / MIN)) : info.lostMinutes;
  const departMs = item.slot.startMs - walkMs; // leave-early
  const arriveMs = prev ? prev.endMs + walkMs : item.slot.startMs; // arrive-late
  const leaveFeasible = prev ? departMs > prev.startMs : false;
  const hm = (ms: number): string => timeInZone(new Date(ms).toISOString(), tz);

  return (
    <>
      <div className="scrim on" onClick={onClose} />
      <div className="sheet on">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="poster sheet-title">Tight walk</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="travel-summary">
          <span className="ms" style={{ fontSize: 16, color: "var(--accent)" }}>directions_walk</span>
          {info.walkMinutes} min from {info.fromStageName} to {item.slot.stageName} — about {lost} min overlaps.
        </div>
        <div className="sheet-body">
          <button
            className={`travel-opt${info.resolution === "leave-early" ? " on" : ""}`}
            disabled={!leaveFeasible}
            onClick={onLeaveEarly}
          >
            <span className="ms">logout</span>
            <span className="min0">
              <span className="travel-opt-title">Leave {prev?.label ?? "the set"} early</span>
              <span className="travel-opt-sub">
                {leaveFeasible ? `Catch all of ${item.slot.label}. Leave at ${hm(departMs)} — miss the last ${lost} min.` : "Not enough time to make this walk."}
              </span>
            </span>
            {info.resolution === "leave-early" && <span className="ms travel-opt-check">check_circle</span>}
          </button>

          <button
            className={`travel-opt${info.resolution === "arrive-late" ? " on" : ""}`}
            onClick={onArriveLate}
          >
            <span className="ms">login</span>
            <span className="min0">
              <span className="travel-opt-title">Arrive at {item.slot.label} late</span>
              <span className="travel-opt-sub">
                Stay to the end of {prev?.label ?? "the set"}. Arrive {hm(arriveMs)} — miss the first {lost} min.
              </span>
            </span>
            {info.resolution === "arrive-late" && <span className="ms travel-opt-check">check_circle</span>}
          </button>

          {info.explicit && (
            <button className="plan-menu-item" onClick={onClear}>
              <span className="ms">restart_alt</span> Use the default again
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function PlanSetRow({
  item,
  i,
  tz,
  editing,
  photoUrl,
  onMenu,
  onTravel,
}: {
  item: PlanSetItem;
  i: number;
  tz: string;
  editing: boolean;
  photoUrl: string | null;
  onMenu: () => void;
  onTravel: () => void;
}): JSX.Element {
  const { openArtist } = useArtistSheet();
  const { slot, status, startMs, endMs, travelIn } = item;
  const start = timeInZone(new Date(startMs).toISOString(), tz);
  const end = timeInZone(new Date(endMs).toISOString(), tz);
  const color = stageColor(slot.stageName);
  const leftEarly = endMs < slot.endMs;
  const inLate = startMs > slot.startMs;
  return (
    <div className="plan-row fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className={`plan-dot ${status}`} />
      <div className="min0" style={{ flex: 1 }}>
        {travelIn && travelIn.resolution !== "none" && (
          <TravelChip travel={travelIn} editing={editing} onClick={onTravel} />
        )}
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
              {leftEarly ? " · leave early" : ""}
              {inLate ? " · in late" : ""}
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
    </div>
  );
}

function TravelChip({
  travel,
  editing,
  onClick,
}: {
  travel: NonNullable<PlanSetItem["travelIn"]>;
  editing: boolean;
  onClick: () => void;
}): JSX.Element {
  const danger = !travel.feasible;
  const text = danger
    ? `Tight: ${travel.walkMinutes} min walk from ${travel.fromStageName}`
    : travel.resolution === "arrive-late"
      ? `Arrive ${travel.lostMinutes} min late · ${travel.walkMinutes} min walk`
      : `Leave early for ${travel.walkMinutes} min walk · −${travel.lostMinutes} min`;
  const className = `plan-travel-chip${danger ? " danger" : ""}${travel.explicit ? " set" : ""}`;
  const icon = danger ? "warning" : travel.resolution === "arrive-late" ? "login" : "logout";
  if (!editing) {
    return (
      <span className={className}>
        <span className="ms" style={{ fontSize: 13 }}>{icon}</span>
        {text}
      </span>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      <span className="ms" style={{ fontSize: 13 }}>{icon}</span>
      {text}
      <span className="ms" style={{ fontSize: 13, marginLeft: "auto" }}>tune</span>
    </button>
  );
}

function PlanBlockRow({
  item,
  i,
  tz,
  editing,
  onEdit,
}: {
  item: PlanBlockItem;
  i: number;
  tz: string;
  editing: boolean;
  onEdit: () => void;
}): JSX.Element {
  const { block, status } = item;
  const meta = BLOCK_KINDS[block.kind];
  const start = timeInZone(new Date(block.startMs).toISOString(), tz);
  const end = timeInZone(new Date(block.endMs).toISOString(), tz);
  const inner = (
    <>
      <span className="block-card-ico ms" aria-hidden="true">{meta.icon}</span>
      <div className="plan-card-main">
        <div className={`plan-when ${status}`}>
          {status === "now" ? "NOW · " : ""}
          {start} – {end}
          {status === "done" ? " · done" : ""}
        </div>
        <div className="poster plan-name">{block.label}</div>
        {block.note && <div className="plan-stage">{block.note}</div>}
      </div>
      {editing && <span className="ms plan-state-ico" aria-hidden="true">tune</span>}
    </>
  );
  return (
    <div className="plan-row fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className={`plan-dot ${status} block`} />
      {editing ? (
        <button type="button" className={`glass plan-card block tappable ${status}`} onClick={onEdit} aria-label={`Edit ${block.label}`}>
          {inner}
        </button>
      ) : (
        <div className={`glass plan-card block ${status}`}>{inner}</div>
      )}
    </div>
  );
}

function PlanGapRow({
  item,
  i,
  editing,
  onRoute,
  onFill,
}: {
  item: PlanGapItem;
  i: number;
  editing: boolean;
  onRoute: () => void;
  onFill: () => void;
}): JSX.Element {
  const fillable = editing && item.freeMinutes >= FILLABLE_THRESHOLD_MIN;
  return (
    <div className="plan-row gap fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className="plan-dot mini" />
      <div className="plan-chips">
        {item.walkMinutes > 0 && (
          <button type="button" className="plan-chip" onClick={onRoute}>
            <span className="ms" style={{ fontSize: 13 }}>directions_walk</span>
            {item.walkMinutes} min walk{item.toStageName ? ` to ${item.toStageName}` : ""}
          </button>
        )}
        {item.breakMinutes >= 20 && (
          <span className="plan-chip">
            <span className="ms" style={{ fontSize: 13 }}>schedule</span>
            {item.breakMinutes} min free
          </span>
        )}
        {fillable && (
          <button type="button" className="plan-chip fill" onClick={onFill}>
            <span className="ms" style={{ fontSize: 13 }}>add</span>
            Fill {item.freeMinutes}m
          </button>
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
