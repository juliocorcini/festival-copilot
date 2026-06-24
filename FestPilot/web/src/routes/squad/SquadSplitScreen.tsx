/**
 * Rich split view (#24.5, DEC-013/019). When the squad spreads across stages in a block, this frames
 * it as normal — a per-stage breakdown of who's where (winner + every non-winner pick), with YOU
 * highlighted and a CTA to set a post-set meeting point (B4). Read-only over the aggregated squad
 * plan (`buildSquadPlan`); never fights the split, only shows it.
 */
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useGroup } from "../../data/groups";
import { useSquadPlan } from "../../data/squadPlan";
import { stageEntriesForBlock, type SquadBlock, type StageEntry } from "../../domain/squadPlan";
import { stageColor, timeInZone } from "../../lib/format";
import { ErrorState, LoadingState } from "../../ui/states";
import { AvatarStack } from "./squadUi";

export function SquadSplitScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id, perfId } = useParams<{ id: string; perfId: string }>();
  const [params] = useSearchParams();
  const day = params.get("day") ?? undefined;
  const { group } = useGroup(id);
  const { plan, timezone, status, reload } = useSquadPlan(id, day);

  const block = useMemo<SquadBlock | null>(
    () => plan?.blocks.find((b) => b.set.id === perfId) ?? null,
    [plan, perfId]
  );
  const entries = useMemo(() => (block ? stageEntriesForBlock(block) : []), [block]);

  if (status === "loading") return <LoadingState rows={4} />;
  if (status === "error" || !plan || !block || !id) {
    return (
      <>
        <StackHeader title="The split" backTo={`/squad/${id}/plan`} />
        <ErrorState message="This block is no longer in the squad plan." onRetry={reload} />
      </>
    );
  }

  const range = `${timeInZone(new Date(block.set.startMs).toISOString(), timezone)} – ${timeInZone(
    new Date(block.set.endMs).toISOString(),
    timezone
  )}`;
  const accounted = entries.reduce((n, e) => n + e.members.length, 0);
  const undecided = Math.max(0, plan.memberCount - accounted);
  const splitting = entries.length > 1;

  return (
    <>
      <StackHeader title={range} backTo={`/squad/${id}/plan?day=${encodeURIComponent(day ?? "")}`} />
      <div className="screen squad-split">
        <div className="label split-day">{group?.name ?? "Squad"} · {day ? titleCase(day) : ""}</div>
        <h1 className="poster split-title">
          {splitting ? (
            <>The squad splits<br />here <span className="split-emoji">🪩</span></>
          ) : (
            <>You're all<br />together <span className="split-emoji">🙌</span></>
          )}
        </h1>
        <p className="split-sub">
          {splitting
            ? "Totally normal — everyone sees who's where, and you can regroup after."
            : "Everyone locked the same set this block. Easy."}
        </p>

        <div className="split-cards">
          {entries.map((e) => (
            <StageCard key={e.set.id} entry={e} />
          ))}
        </div>

        {undecided > 0 && (
          <p className="split-undecided">
            <span className="ms" style={{ fontSize: 14 }}>schedule</span>
            {undecided} {undecided === 1 ? "person hasn't" : "people haven't"} locked this block yet
          </p>
        )}
      </div>

      <div className="squad-actions split-actions">
        <button className="btn btn-primary" onClick={() => navigate(`/squad/${id}/meet`)}>
          <span className="ms">pin_drop</span>
          Set a meet-up after
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => navigate(`/squad/${id}/plan/${perfId}?day=${encodeURIComponent(day ?? "")}`)}
        >
          Back to this block
        </button>
      </div>
    </>
  );
}

function StageCard({ entry }: { entry: StageEntry }): JSX.Element {
  const color = stageColor(entry.set.stageName);
  return (
    <div className={`glass split-card${entry.isYou ? " mine" : ""}`}>
      <div className="split-card-bar" style={{ background: color }} />
      <div className="split-card-body">
        <div className="split-card-top">
          <div className="split-stage">
            {entry.set.stageName}
            {entry.isYou && <span className="split-you"> · you</span>}
          </div>
          <span className="split-count" style={{ color }}>
            {entry.members.length}
          </span>
        </div>
        <div className="split-act">{entry.set.label}</div>
        <AvatarStack members={entry.members} max={6} size={28} />
      </div>
    </div>
  );
}

function titleCase(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}
