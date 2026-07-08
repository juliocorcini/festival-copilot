/**
 * MemberSheet (F17 / DEC-115) — a bottom-sheet profile for a squad member showing:
 *  1. Identity (avatar + name + role)
 *  2. Day-by-day plan comparison vs yours (overlap / only-you / only-them)
 *  3. Quick stats (overlap %, next time together)
 *
 * Accessed by tapping any member name/avatar across the app. Read-only, no "plan together" editing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../data/api";
import { useLineup } from "../../data/useLineup";
import { useOnboarding, usePlan } from "../../data/localStore";
import { daysForWeekends, type DayInfo } from "../../lib/festival";
import { toPlannableSets } from "../../domain/lineup";
import { comparePlans, compareDaySummary, nextSharedSet, type CompareResult, type CompareDay } from "../../domain/memberCompare";
import type { PlannableSet } from "../../domain/types";
import { useLocale, useT } from "../../i18n";
import { toast } from "../../lib/toast";
import { MemberAvatar } from "./squadUi";
import type { SquadMember } from "../../domain/squadPlan";

export interface MemberSheetProps {
  groupId: string;
  member: SquadMember;
  onClose: () => void;
}

type SheetSnap = "half" | "full";
const SNAP_HALF_RATIO = 0.7;
const SNAP_FULL_RATIO = 0.92;

export function MemberSheet({ groupId, member, onClose }: MemberSheetProps): JSX.Element {
  const t = useT();
  const lineup = useLineup();
  const { onboarding } = useOnboarding();
  const locale = useLocale();
  const festivalId = lineup.lineup?.festival.id;

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const allDays = useMemo<DayInfo[]>(
    () => (lineup.lineup ? daysForWeekends(lineup.lineup, weekendIds, locale) : []),
    [lineup.lineup, weekendIds, locale]
  );

  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const activeDay = allDays[activeDayIdx] ?? null;

  const [theirIds, setTheirIds] = useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || allDays.length === 0) return;
    let alive = true;
    setLoading(true);

    (async () => {
      const map = new Map<string, Set<string>>();
      for (const day of allDays) {
        try {
          const raw = await api.getSquadPlan(groupId, day.key);
          const them = raw?.members.find((m) => m.userId === member.userId);
          if (them?.shared && them.performanceIds.length > 0) {
            map.set(day.key, new Set(them.performanceIds));
          }
        } catch { /* non-critical */ }
      }
      if (!alive) return;
      setTheirIds(map);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [groupId, allDays, member.userId]);

  const daySets = useMemo<PlannableSet[]>(() => {
    if (!lineup.lineup || !activeDay) return [];
    return toPlannableSets(lineup.lineup.performances, lineup.lineup.stages)
      .filter((s) => s.day === activeDay.key);
  }, [lineup.lineup, activeDay]);

  const { plan: localPlan } = usePlan(festivalId, activeDay?.key);
  const yourIds = useMemo<Set<string>>(
    () => new Set((localPlan?.slots ?? []).map((s) => s.setId)),
    [localPlan]
  );

  const yourIdsByDay = useMemo<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>();
    if (!festivalId) return map;
    for (const day of allDays) {
      const key = `${festivalId}:${day.key}`;
      try {
        const raw = localStorage.getItem("fp.store.v1");
        if (!raw) continue;
        const store = JSON.parse(raw);
        const p = store?.plans?.[key];
        if (p?.slots?.length) {
          map.set(day.key, new Set(p.slots.map((s: { setId: string }) => s.setId)));
        }
      } catch { /* skip */ }
    }
    return map;
  }, [festivalId, allDays]);

  const comparison = useMemo<CompareResult | null>(() => {
    const theirDayIds = theirIds.get(activeDay?.key ?? "");
    if (!theirDayIds || theirDayIds.size === 0) return null;
    return comparePlans(yourIds, theirDayIds, daySets);
  }, [yourIds, theirIds, activeDay, daySets]);

  const daySummaries = useMemo<CompareDay[]>(
    () => compareDaySummary(
      yourIdsByDay,
      theirIds,
      allDays.map((d) => ({ key: d.key, label: d.weekdayShort }))
    ),
    [yourIdsByDay, theirIds, allDays]
  );

  const nextTogether = useMemo(() => {
    if (!comparison) return null;
    return nextSharedSet(comparison.overlap, Date.now());
  }, [comparison]);

  // Bottom sheet drag — works from anywhere on the sheet
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [height, setHeight] = useState(() => window.innerHeight * SNAP_HALF_RATIO);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHeight(snap === "full" ? window.innerHeight * SNAP_FULL_RATIO : window.innerHeight * SNAP_HALF_RATIO);
  }, [snap]);

  const canDrag = useCallback((): boolean => {
    const el = bodyRef.current;
    if (!el) return true;
    if (el.scrollTop > 0) return false;
    return true;
  }, []);

  const onDragStart = useCallback((clientY: number) => {
    dragging.current = true;
    startY.current = clientY;
    startH.current = height;
  }, [height]);

  const onDragMove = useCallback((clientY: number) => {
    if (!dragging.current) return;
    const delta = startY.current - clientY;
    const maxH = window.innerHeight * SNAP_FULL_RATIO;
    const minH = window.innerHeight * 0.15;
    setHeight(Math.max(minH, Math.min(maxH, startH.current + delta)));
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const ratio = height / window.innerHeight;
    if (ratio < 0.3) {
      onClose();
    } else if (ratio > 0.78) {
      setSnap("full");
    } else {
      setSnap("half");
    }
  }, [height, onClose]);

  const sheetTouch = useMemo(() => ({
    onTouchStart: (e: React.TouchEvent) => {
      if (!canDrag()) return;
      onDragStart(e.touches[0]!.clientY);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!dragging.current) return;
      onDragMove(e.touches[0]!.clientY);
    },
    onTouchEnd: () => onDragEnd(),
  }), [canDrag, onDragStart, onDragMove, onDragEnd]);

  const [requestSent, setRequestSent] = useState(false);

  const handleRequestShare = useCallback(async () => {
    if (requestSent) return;
    try {
      await api.sendPing(groupId, member.userId, "share_plan");
      setRequestSent(true);
      toast.success(t("member.requestShareSent"));
    } catch { /* non-critical */ }
  }, [groupId, member.userId, requestSent, t]);

  const name = member.displayName ?? "?";
  const theirDayIds = theirIds.get(activeDay?.key ?? "");
  const theyShared = theirDayIds != null && theirDayIds.size > 0;
  const youShared = yourIds.size > 0;

  return (
    <div className="member-sheet-backdrop" onClick={onClose}>
      <div
        className="member-sheet"
        style={{ height }}
        onClick={(e) => e.stopPropagation()}
        {...sheetTouch}
      >
        <div className="member-sheet-handle">
          <span className="member-sheet-grip" />
        </div>

        {/* Identity header */}
        <div className="member-sheet-header">
          <MemberAvatar member={member} size={48} ring={false} />
          <div className="member-sheet-identity">
            <span className="member-sheet-name">{name}</span>
            <span className="member-sheet-role">{member.role === "owner" ? "Owner" : "Member"}</span>
          </div>
          <button className="member-sheet-close" onClick={onClose} aria-label={t("member.close")}>
            <span className="ms">close</span>
          </button>
        </div>

        {/* Day picker tabs */}
        {allDays.length > 0 && (
          <div className="member-sheet-days">
            {allDays.map((day, idx) => {
              const summary = daySummaries[idx];
              const hasOverlap = (summary?.overlapCount ?? 0) > 0;
              return (
                <button
                  key={day.key}
                  className={`member-day-tab${idx === activeDayIdx ? " active" : ""}${hasOverlap ? " has-overlap" : ""}`}
                  onClick={() => setActiveDayIdx(idx)}
                >
                  <span className="member-day-label">{day.weekdayShort}</span>
                  {hasOverlap && <span className="member-day-dot" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Comparison body */}
        <div className="member-sheet-body" ref={bodyRef}>
          {loading ? (
            <div className="member-sheet-loading">
              <span className="ms spin">progress_activity</span>
            </div>
          ) : !theyShared ? (
            <div className="member-sheet-empty">
              <span className="ms" aria-hidden="true">event_busy</span>
              <p className="member-empty-title">{t("member.noPlan")}</p>
              <p className="member-empty-sub">{t("member.noPlanSub", { name })}</p>
              <button
                className="btn btn-primary member-request-share"
                onClick={handleRequestShare}
                disabled={requestSent}
              >
                <span className="ms">{requestSent ? "check" : "share"}</span>
                {requestSent ? t("member.requestShareSent") : t("member.requestShare")}
              </button>
            </div>
          ) : !youShared ? (
            <div className="member-sheet-empty">
              <span className="ms" aria-hidden="true">edit_calendar</span>
              <p className="member-empty-title">{t("member.youNoPlan")}</p>
            </div>
          ) : comparison ? (
            <>
              {/* Stats bar */}
              <div className="member-stats">
                <div className="member-stat-pct">
                  <span className="member-stat-value">{Math.round(comparison.overlapRatio * 100)}%</span>
                  <span className="member-stat-label">{t("member.overlap")}</span>
                </div>
                <div className="member-stat-count">
                  <span className="member-stat-value">{comparison.overlap.length}</span>
                  <span className="member-stat-label">{t("member.setsInCommon", { count: comparison.overlap.length })}</span>
                </div>
              </div>

              {/* Next together hero */}
              {nextTogether && (
                <div className="member-next glass">
                  <span className="ms" aria-hidden="true">group</span>
                  <div>
                    <div className="member-next-label">{t("member.nextTogether")}</div>
                    <div className="member-next-set">{nextTogether.label}</div>
                    <div className="member-next-stage">{nextTogether.stageName}</div>
                  </div>
                </div>
              )}

              {/* Timeline slots */}
              <div className="member-timeline">
                {comparison.slots.map((slot) => (
                  <div key={slot.set.id} className={`member-slot kind-${slot.kind}`}>
                    <div className="member-slot-time">
                      {formatTime(slot.set.startMs)}
                    </div>
                    <div className="member-slot-bar" />
                    <div className="member-slot-info">
                      <span className="member-slot-name">{slot.set.label}</span>
                      <span className="member-slot-stage">{slot.set.stageName}</span>
                    </div>
                    <span className={`member-slot-badge badge-${slot.kind}`}>
                      {slot.kind === "both" ? t("member.overlap")
                        : slot.kind === "only_you" ? t("member.onlyYou")
                          : t("member.onlyThem", { name })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="member-sheet-empty">
              <span className="ms" aria-hidden="true">compare_arrows</span>
              <p className="member-empty-title">{t("member.noOverlap")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
