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
  applySplitTravel,
  carveWindow,
  clearTravelChoice,
  editBlockMeta,
  fittingAdds,
  fittingSwaps,
  rangeIsFree,
  removeBlock,
  removeFromPlan,
  resizeBlock,
  swapInPlan,
  type CarveSource,
} from "../domain/planEdit";
import { effectiveEnd, effectiveStart } from "../domain/planSlot";
import { daysForWeekends, initials } from "../lib/festival";
import { stageColor, timeInZone } from "../lib/format";
import { toast } from "../lib/toast";
import { useT, useLocale, type TranslateFn, type MessageKey } from "../i18n";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { ErrorState, LoadingState } from "../ui/states";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { Sheet } from "../ui/Sheet";
import { PHOTO_WIDTH } from "../lib/photo";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";
import { SharePlanSheet } from "./share/SharePlanSheet";
import type { PlanBlock, PlanBlockKind, PlannableSet, PlanSlot } from "../domain/types";

const MIN = 60_000;
const STEP_MS = 15 * MIN;
/** Idle minutes between two cards that already fit a block — below this we carve from a neighbour. */
const INSERT_ROOM_MIN = 10;
/** Default length of a block carved between two back-to-back sets (the user can trim it after). */
const DEFAULT_CARVE_MS = 30 * MIN;

const BLOCK_KINDS: Record<PlanBlockKind, { icon: string; labelKey: MessageKey }> = {
  eat: { icon: "restaurant", labelKey: "plan.kindEat" },
  rest: { icon: "airline_seat_flat", labelKey: "plan.kindRest" },
  water: { icon: "local_drink", labelKey: "plan.kindWater" },
  meet: { icon: "group", labelKey: "plan.kindMeet" },
  explore: { icon: "explore", labelKey: "plan.kindExplore" },
  custom: { icon: "more_horiz", labelKey: "plan.kindCustom" },
};
const PRESET_ORDER: PlanBlockKind[] = ["eat", "rest", "water", "meet", "explore", "custom"];

/** The localized human label for a personal-block kind (icons stay in {@link BLOCK_KINDS}). */
function blockKindLabel(t: TranslateFn, kind: PlanBlockKind): string {
  return t(BLOCK_KINDS[kind].labelKey);
}

interface BlockDraft {
  id: string | null;
  kind: PlanBlockKind;
  label: string;
  startMs: number;
  endMs: number;
  note: string;
}

/** The pair of cards an insert "+" sits between — drives the "where does the time come from?" sheet. */
interface InsertContext {
  before: PlanItem;
  after: PlanItem;
}

export function MyPlanScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
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
  const allDays = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds, locale) : []), [lineup, weekendIds, locale]);
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
  const [insertFor, setInsertFor] = useState<InsertContext | null>(null);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) {
    return (
      <>
        <AppHeader eyebrow={t("plan.yourDay")} title={t("plan.title")} />
        <ErrorState message={error ?? t("plan.loadError")} onRetry={reload} />
      </>
    );
  }

  const title = day ? `${day.weekdayLong} ${dayOfMonth(day.startMs, tz)}` : t("plan.title");
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
    setBlockDraft({ id: null, kind, label: blockKindLabel(t, kind), startMs: gap.fillStartMs, endMs: gap.fillEndMs, note: "" });
  };
  const addBreak = (): void => {
    const window = firstFreeWindow(timeline.items);
    const kind: PlanBlockKind = "eat";
    setBlockDraft({ id: null, kind, label: blockKindLabel(t, kind), startMs: window.startMs, endMs: window.endMs, note: "" });
  };
  const editBlock = (block: PlanBlock): void => {
    setBlockDraft({ id: block.id, kind: block.kind, label: block.label, startMs: block.startMs, endMs: block.endMs, note: block.note ?? "" });
  };
  const commitBlock = (draft: BlockDraft): void => {
    const label = draft.label.trim() || blockKindLabel(t, draft.kind);
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

  // Travel choice (DEC-074/079) — leave early, arrive late, or split the loss. Each only shrinks an
  // effective interval, so the plan stays zero-overlap. Every choice confirms with a toast (C2).
  const resolveTravel = (item: PlanSetItem, choice: "leave-early" | "arrive-late" | "split" | "clear"): void => {
    const info = item.travelIn;
    if (!info) return;
    const prev = slots.find((s) => s.setId === info.fromSetId);
    if (!prev) return;
    const walkMs = info.walkMinutes * MIN;
    const lostMs = Math.max(0, prev.endMs + walkMs - item.slot.startMs);
    const lost = Math.round(lostMs / MIN);
    if (choice === "leave-early") {
      plan.save(applyLeaveEarly(slots, prev.setId, item.slot.setId, item.slot.startMs - walkMs));
      toast.success(t("plan.toastLeftEarly", { name: prev.label, lost }));
    } else if (choice === "arrive-late") {
      plan.save(applyArriveLate(slots, prev.setId, item.slot.setId, prev.endMs + walkMs));
      toast.success(t("plan.toastArrivedLate", { name: item.slot.label, lost }));
    } else if (choice === "split") {
      const fromPrev = Math.floor(lostMs / 2);
      plan.save(applySplitTravel(slots, prev.setId, item.slot.setId, prev.endMs - fromPrev, item.slot.startMs + (lostMs - fromPrev)));
      toast.success(t("plan.toastSplit", { lost }));
    } else {
      plan.save(clearTravelChoice(slots, prev.setId, item.slot.setId));
      toast.info(t("plan.toastTravelCleared"));
    }
    setTravelFor(null);
  };

  // Open the exact tapped walk leg on the map (DEC-079): real from/to/at, never a recomputed leg.
  const routeForTravel = (item: PlanSetItem): void => {
    const prev = item.travelIn ? slots.find((s) => s.setId === item.travelIn!.fromSetId) : undefined;
    navigate(routeHref(dayKey, { fromStageId: prev?.stageId ?? undefined, toStageId: item.slot.stageId ?? undefined, atMs: item.startMs }));
    setTravelFor(null);
  };

  // Insert between two cards (DEC-081). With idle room, open the editor on that window; back-to-back,
  // carve the time from a neighbour. A set insert reuses the fitting-adds picker (lands chronologically).
  const insertBlockInWindow = (kind: PlanBlockKind, startMs: number, endMs: number): void => {
    setBlockDraft({ id: null, kind, label: blockKindLabel(t, kind), startMs, endMs, note: "" });
    setInsertFor(null);
  };
  const carveInsertBlock = (kind: PlanBlockKind, beforeSetId: string, afterSetId: string, source: CarveSource): void => {
    const carve = carveWindow(slots, beforeSetId, afterSetId, DEFAULT_CARVE_MS, source);
    if (!carve) return;
    const label = blockKindLabel(t, kind);
    const nextBlocks = addBlock(carve.slots, blocks, { id: cryptoId(), kind, label, startMs: carve.startMs, endMs: carve.endMs });
    if (!nextBlocks) return;
    plan.save(carve.slots);
    plan.saveBlocks(nextBlocks);
    toast.success(t("plan.toastInserted", { label }));
    setInsertFor(null);
  };
  const insertSet = (): void => {
    setInsertFor(null);
    setShowAdd(true);
  };

  // Build the timeline rows, threading an insert "+" between every two adjacent cards (edit mode).
  const timelineNodes: JSX.Element[] = [];
  let prevCard: PlanItem | null = null;
  timeline.items.forEach((item, index) => {
    const i = Math.min(index, 11);
    if (item.kind === "gap") {
      timelineNodes.push(<PlanGapRow key={`gap-${index}`} i={i} item={item} editing={editing} onFill={() => fillGap(item)} />);
      return;
    }
    if (editing && prevCard) {
      const before = prevCard;
      timelineNodes.push(<InsertDivider key={`ins-${index}`} before={before} after={item} onClick={() => setInsertFor({ before, after: item })} />);
    }
    if (item.kind === "set") {
      const prevSlot = item.travelIn ? slots.find((s) => s.setId === item.travelIn!.fromSetId) : undefined;
      const isSplit = !!(prevSlot && prevSlot.cutMs != null && item.slot.lateStartMs != null);
      timelineNodes.push(
        <PlanSetRow
          key={item.slot.setId}
          item={item}
          i={i}
          tz={tz}
          isSplit={isSplit}
          photoUrl={photoByKey.get(item.slot.actKey) ?? null}
          onMenu={() => setMenuFor(item.slot)}
          onTravel={() => setTravelFor(item)}
        />
      );
    } else {
      timelineNodes.push(<PlanBlockRow key={item.block.id} item={item} i={i} tz={tz} editing={editing} onEdit={() => editBlock(item.block)} />);
    }
    prevCard = item;
  });

  return (
    <>
      <AppHeader
        eyebrow={t("plan.title")}
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
                {editing ? t("plan.done") : t("plan.edit")}
              </button>
              <button className="ava-sm" aria-label={t("plan.sharePlan")} onClick={() => setShowShare(true)}>
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
              {t("plan.summarySets", { count: timeline.setCount, sets: timeline.setCount === 1 ? t("common.set") : t("common.sets") })}
              {timeline.blockCount > 0
                ? t("plan.summaryPlans", { count: timeline.blockCount, plans: timeline.blockCount === 1 ? t("common.plan") : t("common.plans") })
                : ""}
              {timeline.breakCount > 0
                ? t("plan.summaryBreaks", { count: timeline.breakCount, breaks: timeline.breakCount === 1 ? t("common.break") : t("common.breaks") })
                : ""}
            </span>
          )}
        </div>
      )}

      {!hasPlan ? (
        <div className="state">
          <span className="ms">event_available</span>
          <h2>{t("plan.noPlanTitle")}</h2>
          <p>{t("plan.noPlanMsg", { day: day ? day.weekdayLong : t("plan.theDay") })}</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/lockin${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
          >
            <span className="ms">lock</span> {t("plan.lockInMyDay")}
          </button>
        </div>
      ) : (
        <div className="plan-scroll">
          <div className="plan-tl">
            <div className="plan-tl-line" />
            {timelineNodes}
            <div className="plan-row">
              <span className="plan-dot mini" />
              <div className="plan-add-row">
                <button className="plan-chip" onClick={() => setShowAdd(true)}>
                  <span className="ms" style={{ fontSize: 14 }}>add</span> {t("plan.addASet")}
                </button>
                {editing && (
                  <button className="plan-chip" onClick={addBreak}>
                    <span className="ms" style={{ fontSize: 14 }}>more_time</span> {t("plan.addABreak")}
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
          photos={photoByKey}
          onClose={() => setShowShare(false)}
        />
      )}

      {menuFor && (
        <PlanItemMenu
          slot={menuFor}
          tz={tz}
          onSwap={() => setSwapFor(menuFor)}
          onRemove={() => removeSet(menuFor.setId)}
          onMap={() => navigate(routeHref(dayKey, { toStageId: menuFor.stageId ?? undefined }))}
          onClose={() => setMenuFor(null)}
        />
      )}

      {swapFor && (
        <SetPickerSheet
          title={t("plan.swapTitle", { name: swapFor.label })}
          hint={t("plan.swapHint")}
          action="swap"
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
          title={t("plan.addASet")}
          hint={t("plan.addHint")}
          action="add"
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
          onSplit={() => resolveTravel(travelFor, "split")}
          onClear={() => resolveTravel(travelFor, "clear")}
          onRoute={() => routeForTravel(travelFor)}
          onClose={() => setTravelFor(null)}
        />
      )}

      {insertFor && (
        <InsertSheet
          before={insertFor.before}
          after={insertFor.after}
          slots={slots}
          onBlockInWindow={insertBlockInWindow}
          onCarve={carveInsertBlock}
          onAddSet={insertSet}
          onClose={() => setInsertFor(null)}
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
  const t = useT();
  return (
    <Sheet onClose={onClose} label={slot.label}>
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
          <span className="ms">map</span> {t("plan.viewOnMap")}
        </button>
        <button className="plan-menu-item" onClick={onSwap}>
          <span className="ms">swap_horiz</span> {t("plan.swapSet")}
        </button>
        <button className="plan-menu-item danger" onClick={onRemove}>
          <span className="ms">delete</span> {t("plan.removeFromPlan")}
        </button>
      </div>
    </Sheet>
  );
}

function SetPickerSheet({
  title,
  hint,
  action,
  tz,
  options,
  onPick,
  onClose,
}: {
  title: string;
  hint: string;
  action: "swap" | "add";
  tz: string;
  options: PlannableSet[];
  onPick: (set: PlannableSet) => void;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? options.filter((set) => set.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  return (
    <Sheet onClose={onClose} label={title}>
      <div className="sheet-head">
        <div className="poster sheet-title">{title}</div>
        <button className="ms sheet-x" onClick={onClose}>close</button>
      </div>
      <div className="search">
        <span className="ms" style={{ color: "var(--muted)", fontSize: 20 }}>search</span>
        <input placeholder={t("common.searchArtists")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("common.searchArtistsAria")} />
      </div>
      <div className="sheet-body">
        {filtered.length === 0 ? (
          <p className="lk-note">{t("plan.noFit")}</p>
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
              <button className="addpill" onClick={() => onPick(set)}>{action === "swap" ? t("plan.swap") : t("plan.add")}</button>
            </div>
          ))
        )}
        <p className="lk-note">{hint}</p>
      </div>
    </Sheet>
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
  const t = useT();
  const valid = rangeIsFree(slots, blocks, { startMs: draft.startMs, endMs: draft.endMs }, draft.id ?? undefined);
  const durationMin = Math.max(0, Math.round((draft.endMs - draft.startMs) / MIN));
  const pickKind = (kind: PlanBlockKind): void => {
    const wasDefault = draft.label.trim() === "" || PRESET_ORDER.some((k) => blockKindLabel(t, k) === draft.label.trim());
    onChange({ ...draft, kind, label: wasDefault ? blockKindLabel(t, kind) : draft.label });
  };
  const sheetTitle = draft.id ? t("plan.editPlan") : t("plan.addToYourDay");
  return (
    <Sheet onClose={onClose} label={sheetTitle}>
      <div className="sheet-head">
        <div className="poster sheet-title">{sheetTitle}</div>
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
              {blockKindLabel(t, kind)}
            </button>
          ))}
        </div>

        <label className="block-field">
          <span className="block-field-label">{t("plan.label")}</span>
          <input
            className="block-input"
            value={draft.label}
            placeholder={blockKindLabel(t, draft.kind)}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            aria-label={t("plan.blockLabelAria")}
          />
        </label>

        <div className="block-times">
          <TimeStepper
            label={t("plan.from")}
            valueMs={draft.startMs}
            tz={tz}
            onChange={(startMs) => onChange({ ...draft, startMs, endMs: Math.max(draft.endMs, startMs + STEP_MS) })}
          />
          <TimeStepper
            label={t("plan.to")}
            valueMs={draft.endMs}
            tz={tz}
            min={draft.startMs + STEP_MS}
            onChange={(endMs) => onChange({ ...draft, endMs })}
          />
          <span className="block-duration">{t("plan.minShort", { min: durationMin })}</span>
        </div>

        <label className="block-field">
          <span className="block-field-label">{t("plan.noteOptional")}</span>
          <input
            className="block-input"
            value={draft.note}
            placeholder={t("plan.notePlaceholder")}
            onChange={(e) => onChange({ ...draft, note: e.target.value })}
            aria-label={t("plan.blockNoteAria")}
          />
        </label>

        {!valid && <p className="block-error"><span className="ms" style={{ fontSize: 14 }}>error</span> {t("plan.overlapError")}</p>}

        <button className="btn btn-primary" disabled={!valid} onClick={() => onCommit(draft)}>
          <span className="ms">{draft.id ? "check" : "add"}</span> {draft.id ? t("plan.save") : t("plan.addToPlan")}
        </button>
        {onDelete && (
          <button className="plan-menu-item danger" onClick={onDelete}>
            <span className="ms">delete</span> {t("plan.removeFromPlan")}
          </button>
        )}
      </div>
    </Sheet>
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
  const t = useT();
  const dec = (): void => {
    const next = valueMs - STEP_MS;
    if (min == null || next >= min) onChange(next);
  };
  return (
    <div className="time-stepper">
      <span className="time-stepper-label">{label}</span>
      <div className="time-stepper-ctrl">
        <button className="time-stepper-btn" aria-label={t("plan.earlier", { label })} onClick={dec}>
          <span className="ms" style={{ fontSize: 18 }}>remove</span>
        </button>
        <span className="time-stepper-val">{timeInZone(new Date(valueMs).toISOString(), tz)}</span>
        <button className="time-stepper-btn" aria-label={t("plan.later", { label })} onClick={() => onChange(valueMs + STEP_MS)}>
          <span className="ms" style={{ fontSize: 18 }}>add</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Adjust a walk between two sets (DEC-079): leave the previous one early, arrive at this one late, or
 * split the loss down the middle — each labelled in minutes of music given up, all reversible. Also
 * the single place to open the exact leg on the map. Reachable in AND out of Edit mode (D18).
 */
function TravelSheet({
  item,
  slots,
  tz,
  onLeaveEarly,
  onArriveLate,
  onSplit,
  onClear,
  onRoute,
  onClose,
}: {
  item: PlanSetItem;
  slots: PlanSlot[];
  tz: string;
  onLeaveEarly: () => void;
  onArriveLate: () => void;
  onSplit: () => void;
  onClear: () => void;
  onRoute: () => void;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const info = item.travelIn!;
  const prev = slots.find((s) => s.setId === info.fromSetId);
  const walkMs = info.walkMinutes * MIN;
  const lostMs = prev ? Math.max(0, prev.endMs + walkMs - item.slot.startMs) : info.lostMinutes * MIN;
  const lost = Math.round(lostMs / MIN);
  const lostHalf = Math.round(lostMs / 2 / MIN);
  const departMs = item.slot.startMs - walkMs; // leave-early
  const arriveMs = prev ? prev.endMs + walkMs : item.slot.startMs; // arrive-late
  const hm = (ms: number): string => timeInZone(new Date(ms).toISOString(), tz);
  const prevLabel = prev?.label ?? t("plan.theSet");

  const leaveFeasible = prev ? departMs > prev.startMs : false;
  const splitFeasible = !!(prev && lostMs > 0 && prev.endMs - Math.floor(lostMs / 2) > prev.startMs);
  // The user's EXPLICIT choice (raw cut/late), so a split highlights as a split — not as arrive-late.
  const cutOn = !!(prev && prev.cutMs != null && prev.cutMs > prev.startMs && prev.cutMs < prev.endMs);
  const lateOn = item.slot.lateStartMs != null && item.slot.lateStartMs > item.slot.startMs && item.slot.lateStartMs < item.slot.endMs;
  const splitOn = cutOn && lateOn;
  const leaveOn = cutOn && !lateOn;
  const lateSelected = lateOn && !cutOn;
  const showOptions = lostMs > 0 || info.explicit;

  return (
    <Sheet onClose={onClose} label={t("plan.walkSheetTitle", { stage: item.slot.stageName })}>
      <div className="sheet-head">
        <div className="poster sheet-title">{t("plan.walkSheetTitle", { stage: item.slot.stageName })}</div>
        <button className="ms sheet-x" onClick={onClose}>close</button>
      </div>
      <div className="travel-summary">
        <span className="ms" style={{ fontSize: 16, color: "var(--accent)" }}>directions_walk</span>
        {lost > 0
          ? t("plan.tightWalkSummary", { min: info.walkMinutes, from: info.fromStageName, to: item.slot.stageName, lost })
          : t("plan.walkSummary", { min: info.walkMinutes, from: info.fromStageName, to: item.slot.stageName })}
      </div>
      <div className="sheet-body">
        {showOptions && (
          <>
            <button className={`travel-opt${leaveOn ? " on" : ""}`} disabled={!leaveFeasible} onClick={onLeaveEarly}>
              <span className="ms">logout</span>
              <span className="min0">
                <span className="travel-opt-title">{t("plan.leaveEarlyTitle", { name: prevLabel })}</span>
                <span className="travel-opt-sub">
                  {leaveFeasible ? t("plan.leaveEarlySub", { name: item.slot.label, time: hm(departMs), lost }) : t("plan.notEnoughTime")}
                </span>
              </span>
              {leaveOn && <span className="ms travel-opt-check">check_circle</span>}
            </button>

            <button className={`travel-opt${lateSelected ? " on" : ""}`} onClick={onArriveLate}>
              <span className="ms">login</span>
              <span className="min0">
                <span className="travel-opt-title">{t("plan.arriveLateTitle", { name: item.slot.label })}</span>
                <span className="travel-opt-sub">{t("plan.arriveLateSub", { prev: prevLabel, time: hm(arriveMs), lost })}</span>
              </span>
              {lateSelected && <span className="ms travel-opt-check">check_circle</span>}
            </button>

            <button className={`travel-opt${splitOn ? " on" : ""}`} disabled={!splitFeasible} onClick={onSplit}>
              <span className="ms">swap_vert</span>
              <span className="min0">
                <span className="travel-opt-title">{t("plan.splitTitle")}</span>
                <span className="travel-opt-sub">{t("plan.splitSub", { prev: prevLabel, next: item.slot.label, lost: lostHalf })}</span>
              </span>
              {splitOn && <span className="ms travel-opt-check">check_circle</span>}
            </button>
          </>
        )}

        <button className="plan-menu-item" onClick={onRoute}>
          <span className="ms">map</span> {t("plan.viewWalk")}
        </button>
        {info.explicit && (
          <button className="plan-menu-item" onClick={onClear}>
            <span className="ms">restart_alt</span> {t("plan.useDefault")}
          </button>
        )}
      </div>
    </Sheet>
  );
}

function PlanSetRow({
  item,
  i,
  tz,
  isSplit,
  photoUrl,
  onMenu,
  onTravel,
}: {
  item: PlanSetItem;
  i: number;
  tz: string;
  isSplit: boolean;
  photoUrl: string | null;
  onMenu: () => void;
  onTravel: () => void;
}): JSX.Element {
  const { openArtist } = useArtistSheet();
  const t = useT();
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
        {travelIn && travelIn.walkMinutes > 0 && (
          <TravelChip travel={travelIn} isSplit={isSplit} onClick={onTravel} />
        )}
        <div
          className={`glass plan-card tappable ${status}`}
          role="button"
          tabIndex={0}
          aria-label={t("common.viewAct", { name: slot.label })}
          onClick={() => openArtist(slot.actKey)}
          onKeyDown={openOnActivate(() => openArtist(slot.actKey))}
        >
          <ArtistPhoto src={photoUrl} name={slot.label} width={PHOTO_WIDTH.list} className="plan-photo" />
          <div className="plan-card-main">
            <div className={`plan-when ${status}`}>
              {status === "now" ? t("plan.nowDot") : ""}
              {start} – {end}
              {status === "done" ? t("plan.doneSuffix") : ""}
              {leftEarly ? t("plan.leaveEarlySuffix") : ""}
              {inLate ? t("plan.inLateSuffix") : ""}
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
            aria-label={t("plan.editAct", { name: slot.label })}
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

/**
 * The single walk indicator for a transition (DEC-079/D17): it lives on the destination set's card,
 * the gap row shows only free time. Always a button — tapping opens the {@link TravelSheet} in or out
 * of Edit (D18). Text reflects the resolution: tight warning, split, arrive-late, leave-early, or a
 * neutral "{n} min walk" for a roomy hop.
 */
function TravelChip({
  travel,
  isSplit,
  onClick,
}: {
  travel: NonNullable<PlanSetItem["travelIn"]>;
  isSplit: boolean;
  onClick: () => void;
}): JSX.Element {
  const t = useT();
  const danger = !travel.feasible;
  const text = danger
    ? t("plan.tightChip", { min: travel.walkMinutes, from: travel.fromStageName })
    : isSplit
      ? t("plan.splitChip", { lost: travel.lostMinutes })
      : travel.resolution === "arrive-late"
        ? t("plan.arriveLateChip", { lost: travel.lostMinutes, min: travel.walkMinutes })
        : travel.resolution === "leave-early"
          ? t("plan.leaveEarlyChip", { min: travel.walkMinutes, lost: travel.lostMinutes })
          : t("plan.walkChip", { min: travel.walkMinutes });
  const adjusted = isSplit || travel.resolution !== "none";
  const className = `plan-travel-chip${danger ? " danger" : ""}${travel.explicit ? " set" : ""}`;
  const icon = danger ? "warning" : isSplit ? "swap_vert" : travel.resolution === "arrive-late" ? "login" : adjusted ? "logout" : "directions_walk";
  return (
    <button type="button" className={className} onClick={onClick} aria-label={t("plan.viewWalk")}>
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
  const t = useT();
  const { block, status } = item;
  const meta = BLOCK_KINDS[block.kind];
  const start = timeInZone(new Date(block.startMs).toISOString(), tz);
  const end = timeInZone(new Date(block.endMs).toISOString(), tz);
  const inner = (
    <>
      <span className="block-card-ico ms" aria-hidden="true">{meta.icon}</span>
      <div className="plan-card-main">
        <div className={`plan-when ${status}`}>
          {status === "now" ? t("plan.nowDot") : ""}
          {start} – {end}
          {status === "done" ? t("plan.doneSuffix") : ""}
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
        <button type="button" className={`glass plan-card block tappable ${status}`} onClick={onEdit} aria-label={t("plan.editAct", { name: block.label })}>
          {inner}
        </button>
      ) : (
        <div className={`glass plan-card block ${status}`}>{inner}</div>
      )}
    </div>
  );
}

/**
 * The idle stretch between two cards — free time ONLY. The walk now lives on the next set's card
 * (DEC-079/D17), so a gap that's purely a walk renders nothing; a break or a fillable window still
 * surfaces here. Inserting between cards is the `+` divider (DEC-081), not this row.
 */
function PlanGapRow({
  item,
  i,
  editing,
  onFill,
}: {
  item: PlanGapItem;
  i: number;
  editing: boolean;
  onFill: () => void;
}): JSX.Element | null {
  const t = useT();
  const fillable = editing && item.freeMinutes >= FILLABLE_THRESHOLD_MIN;
  const showBreak = item.breakMinutes >= 20;
  if (!showBreak && !fillable) return null;
  return (
    <div className="plan-row gap fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className="plan-dot mini" />
      <div className="plan-chips">
        {showBreak && (
          <span className="plan-chip">
            <span className="ms" style={{ fontSize: 13 }}>schedule</span>
            {t("plan.freeChip", { min: item.breakMinutes })}
          </span>
        )}
        {fillable && (
          <button type="button" className="plan-chip fill" onClick={onFill}>
            <span className="ms" style={{ fontSize: 13 }}>add</span>
            {t("plan.fillChip", { min: item.freeMinutes })}
          </button>
        )}
      </div>
    </div>
  );
}

function cardLabel(item: PlanItem): string {
  return item.kind === "set" ? item.slot.label : item.kind === "block" ? item.block.label : "";
}
/** The effective end of a card — the boundary an inserted item starts from (matches `rangeIsFree`). */
function cardEndMs(item: PlanItem): number {
  return item.kind === "set" ? effectiveEnd(item.slot) : item.kind === "block" ? item.block.endMs : 0;
}
function cardStartMs(item: PlanItem): number {
  return item.kind === "set" ? effectiveStart(item.slot) : item.kind === "block" ? item.block.startMs : 0;
}

/** The "+" affordance on the rail between two adjacent cards (edit mode) — opens the insert sheet. */
function InsertDivider({ before, after, onClick }: { before: PlanItem; after: PlanItem; onClick: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className="plan-row plan-insert-row">
      <span className="plan-insert-dot" />
      <button
        type="button"
        className="plan-insert-btn"
        aria-label={t("plan.insertAria", { from: cardLabel(before), to: cardLabel(after) })}
        onClick={onClick}
      >
        <span className="ms" aria-hidden="true">add</span>
      </button>
    </div>
  );
}

/**
 * Insert between two cards (DEC-081). Pick a block preset or another set. With idle room the block
 * editor opens on that exact window; when the two sets run back-to-back it asks "where does the time
 * come from?" — leave the previous early, arrive at the next late, or split — carving via `planEdit`
 * so the plan stays zero-overlap.
 */
function InsertSheet({
  before,
  after,
  slots,
  onBlockInWindow,
  onCarve,
  onAddSet,
  onClose,
}: {
  before: PlanItem;
  after: PlanItem;
  slots: PlanSlot[];
  onBlockInWindow: (kind: PlanBlockKind, startMs: number, endMs: number) => void;
  onCarve: (kind: PlanBlockKind, beforeSetId: string, afterSetId: string, source: CarveSource) => void;
  onAddSet: () => void;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const [kind, setKind] = useState<PlanBlockKind | null>(null);
  const beforeSet = before.kind === "set" ? before.slot : null;
  const afterSet = after.kind === "set" ? after.slot : null;
  const winStart = cardEndMs(before);
  const winEnd = cardStartMs(after);
  const freeMin = Math.max(0, Math.round((winEnd - winStart) / MIN));
  const bothSets = !!(beforeSet && afterSet);
  const hasRoom = freeMin >= INSERT_ROOM_MIN;
  const fromLabel = cardLabel(before);
  const toLabel = cardLabel(after);

  const pickKind = (k: PlanBlockKind): void => {
    if (hasRoom || !bothSets) onBlockInWindow(k, winStart, winEnd);
    else setKind(k);
  };

  if (kind && beforeSet && afterSet) {
    return (
      <Sheet onClose={onClose} label={t("plan.timeSourceTitle")}>
        <div className="sheet-head">
          <div className="poster sheet-title">{t("plan.timeSourceTitle")}</div>
          <button className="ms sheet-x" onClick={onClose}>close</button>
        </div>
        <div className="travel-summary">
          <span className="ms" style={{ fontSize: 16, color: "var(--accent)" }}>{BLOCK_KINDS[kind].icon}</span>
          {t("plan.timeSourceSub", { what: blockKindLabel(t, kind), from: fromLabel, to: toLabel })}
        </div>
        <div className="sheet-body">
          {(["before", "after", "split"] as CarveSource[]).map((source) => {
            const carve = carveWindow(slots, beforeSet.setId, afterSet.setId, DEFAULT_CARVE_MS, source);
            const min = carve ? Math.round((carve.endMs - carve.startMs) / MIN) : 0;
            const title =
              source === "before"
                ? t("plan.leaveEarlyTitle", { name: fromLabel })
                : source === "after"
                  ? t("plan.arriveLateTitle", { name: toLabel })
                  : t("plan.splitTitle");
            const sub = !carve ? t("plan.carveNoRoom") : source === "split" ? t("plan.carveHalf", { min }) : t("plan.carveFrees", { min });
            const icon = source === "before" ? "logout" : source === "after" ? "login" : "swap_vert";
            return (
              <button key={source} className="travel-opt" disabled={!carve} onClick={() => onCarve(kind, beforeSet.setId, afterSet.setId, source)}>
                <span className="ms">{icon}</span>
                <span className="min0">
                  <span className="travel-opt-title">{title}</span>
                  <span className="travel-opt-sub">{sub}</span>
                </span>
              </button>
            );
          })}
          <button className="plan-menu-item" onClick={() => setKind(null)}>
            <span className="ms">arrow_back</span> {t("common.back")}
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} label={t("plan.insertHere")}>
      <div className="sheet-head">
        <div className="poster sheet-title">{t("plan.insertHere")}</div>
        <button className="ms sheet-x" onClick={onClose}>close</button>
      </div>
      <div className="plan-menu-meta">
        <span className="ms" style={{ fontSize: 15, color: "var(--accent)" }}>{hasRoom ? "schedule" : "fast_forward"}</span>
        {hasRoom ? t("plan.insertFree", { min: freeMin }) : t("plan.insertBackToBack")}
      </div>
      <div className="sheet-body">
        <div className="block-presets">
          {PRESET_ORDER.map((k) => (
            <button key={k} className="block-preset" onClick={() => pickKind(k)}>
              <span className="ms" aria-hidden="true">{BLOCK_KINDS[k].icon}</span>
              {blockKindLabel(t, k)}
            </button>
          ))}
        </div>
        <button className="plan-menu-item" onClick={onAddSet}>
          <span className="ms">library_music</span> {t("plan.insertAddSet")}
        </button>
      </div>
    </Sheet>
  );
}

function dayOfMonth(startMs: number, timeZone: string): string {
  if (!Number.isFinite(startMs)) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone }).format(startMs);
}

/**
 * Build the `/route` link. When a leg is given (the tapped walk transition), pass its exact
 * `from`/`to`/`at` so RouteScreen opens that very leg instead of recomputing now/next (DEC-079).
 */
function routeHref(
  dayKey: string | null,
  leg?: { fromStageId?: string; toStageId?: string; atMs?: number }
): string {
  const params = new URLSearchParams();
  if (dayKey) params.set("day", dayKey);
  if (leg?.fromStageId) params.set("from", leg.fromStageId);
  if (leg?.toStageId) params.set("to", leg.toStageId);
  if (leg?.atMs != null && Number.isFinite(leg.atMs)) params.set("at", String(leg.atMs));
  const qs = params.toString();
  return `/route${qs ? `?${qs}` : ""}`;
}
