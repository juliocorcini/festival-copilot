/**
 * Group plan history (#G4 / E07 — DEC-095). The squad's living record of who changed their plan and
 * when, narrated in plain language. The aggregation never moves here — this is a read-only log of the
 * member re-shares that feed it. Opening the screen marks the history as seen (clears the notice
 * badge on the plan screen). Each line is built from the server's structured numbers via i18n.
 */
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useGroup } from "../../data/groups";
import { useSquadPlanNotice } from "../../data/squadPlan";
import { useT, type TranslateFn } from "../../i18n";
import { Avatar } from "../../ui/Avatar";
import { ErrorState, LoadingState } from "../../ui/states";
import type { SquadPlanChangeDto } from "../../data/types";

export function SquadPlanHistoryScreen(): JSX.Element {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { group } = useGroup(id);
  const { changes, status, reload, markSeen } = useSquadPlanNotice(id);

  // Opening the history is the "seen" signal — clears the badge on the plan screen.
  useEffect(() => {
    if (status === "ready") markSeen();
  }, [status, markSeen]);

  const title = `${group?.emoji ? `${group.emoji} ` : ""}${t("history.title")}`;

  return (
    <>
      <StackHeader title={title} backTo={`/squad/${id}/plan`} />
      <div className="screen squad-history">
        <p className="board-intro">{t("history.intro")}</p>

        {status === "loading" && <LoadingState rows={3} />}
        {status === "error" && <ErrorState message={t("history.loadError")} onRetry={reload} />}

        {status === "ready" && changes.length === 0 && (
          <div className="glass history-empty">
            <span className="ms">history</span>
            <div className="history-empty-title">{t("history.emptyTitle")}</div>
            <p>{t("history.emptySub")}</p>
          </div>
        )}

        {status === "ready" && changes.length > 0 && (
          <div className="history-list">
            {changes.map((c) => (
              <HistoryRow key={c.id} change={c} t={t} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function HistoryRow({ change, t }: { change: SquadPlanChangeDto; t: TranslateFn }): JSX.Element {
  const name = change.actorName ?? t("common.guest");
  const headline = narrate(change, name, t);
  const delta = deltaLabel(change, t);
  return (
    <article className="glass history-row">
      <Avatar color={change.actorColor} name={change.actorName} size={34} className="history-ava" />
      <div className="history-main">
        <div className="history-headline">
          {headline}
          {change.isMine && <span className="member-you"> · {t("common.you")}</span>}
        </div>
        <div className="history-meta">
          {relTime(change.updatedAtUtc, t)}
          {change.day ? ` · ${dayTitle(change.day)}` : ""}
          {delta ? ` · ${delta}` : ""}
        </div>
      </div>
    </article>
  );
}

/** The plain-language sentence for one change, built from the structured counts (locale via i18n). */
function narrate(change: SquadPlanChangeDto, name: string, t: TranslateFn): string {
  if (change.kind === "unshare") return t("history.unshared", { name });
  const key = change.pickCount === 1 ? "history.shareOne" : "history.shareMany";
  return t(key, { name, count: change.pickCount });
}

/** A compact "+2 · −1" tail when the change moved picks (kept tiny — the headline carries the meaning). */
function deltaLabel(change: SquadPlanChangeDto, t: TranslateFn): string {
  if (change.kind !== "share") return "";
  const parts: string[] = [];
  if (change.addedCount > 0) parts.push(t("history.deltaAdded", { n: change.addedCount }));
  if (change.removedCount > 0) parts.push(t("history.deltaRemoved", { n: change.removedCount }));
  return parts.join(" · ");
}

/** Relative time, i18n-aware ("just now" / "5m ago" / "2h ago" / "3d ago"). */
function relTime(iso: string, t: TranslateFn): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const min = Math.round((Date.now() - then) / 60_000);
  if (min < 1) return t("time.justNow");
  if (min < 60) return t("time.minutesAgo", { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t("time.hoursAgo", { n: hr });
  return t("time.daysAgo", { n: Math.round(hr / 24) });
}

/** Festival day key (e.g. "SATURDAY") → title case for display. */
function dayTitle(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}
