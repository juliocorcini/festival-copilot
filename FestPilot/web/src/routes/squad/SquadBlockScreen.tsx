/**
 * Block detail (#24.2 / #24.3 / #24.5). Shows the squad pick for a block, who's where (the split),
 * and — when your locked must-see doesn't match — the never-silent contract (DEC-013): Join the
 * squad or Keep your lock, plus your own favorites-fallback (DEC-019). The owner can Override.
 *
 * "Join" is a real edit: it swaps the overlapping slot in your LOCAL plan for the target set and
 * re-shares — we only ever change your plan when YOU choose to.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api, type ShareSlotInput } from "../../data/api";
import { useGroup } from "../../data/groups";
import { setPlan, loadStore, saveStore } from "../../data/localStore";
import { useSquadPlan } from "../../data/squadPlan";
import type { SquadBlock } from "../../domain/squadPlan";
import type { PlannableSet, PlanSlot } from "../../domain/types";
import { stageColor, timeInZone } from "../../lib/format";
import { ErrorState, LoadingState } from "../../ui/states";
import { AvatarStack, methodLabel } from "./squadUi";

function slotToShare(slot: PlanSlot): ShareSlotInput {
  return { performanceId: slot.setId, endOverrideUtc: slot.cutMs != null ? new Date(slot.cutMs).toISOString() : null };
}

export function SquadBlockScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id, perfId } = useParams<{ id: string; perfId: string }>();
  const [params] = useSearchParams();
  const day = params.get("day") ?? undefined;
  const { group } = useGroup(id);
  const { plan, raw, timezone, status, reload } = useSquadPlan(id, day);
  const [busy, setBusy] = useState(false);

  const block = useMemo<SquadBlock | null>(
    () => plan?.blocks.find((b) => b.set.id === perfId) ?? null,
    [plan, perfId]
  );

  const isOwner = group?.role === "owner";
  const me = raw?.members.find((m) => m.isYou);

  if (status === "loading") return <LoadingState rows={4} />;
  if (status === "error" || !plan || !block || !id) {
    return (
      <>
        <StackHeader title="Block" backTo={`/squad/${id}/plan`} />
        <ErrorState message="This block is no longer in the squad plan." onRetry={reload} />
      </>
    );
  }

  const winner = block.set;
  const range = `${timeInZone(new Date(winner.startMs).toISOString(), timezone)} – ${timeInZone(new Date(winner.endMs).toISOString(), timezone)}`;
  const conflict = block.youStatus === "conflict";

  /** Swap any overlapping slot in the local plan for `target`, then re-share (your choice only). */
  const joinSet = async (target: PlannableSet): Promise<void> => {
    if (!group || !day || busy) return;
    setBusy(true);
    try {
      const festivalId = group.festivalId;
      const key = `${festivalId}:${day}`;
      const current = loadStore().plans[key]?.slots ?? [];
      const kept = current.filter((s) => !(s.startMs < target.endMs && (s.cutMs ?? s.endMs) > target.startMs));
      const newSlot: PlanSlot = {
        setId: target.id,
        actKey: target.actKey,
        label: target.label,
        stageId: target.stageId,
        stageName: target.stageName,
        startMs: target.startMs,
        endMs: target.endMs,
        cutMs: null,
      };
      const next = [...kept, newSlot].sort((a, b) => a.startMs - b.startMs);
      saveStore(setPlan(loadStore(), festivalId, day, next));
      await api.shareMyPlan(id, {
        day,
        slots: next.map(slotToShare),
        shareFavorites: me?.shareFavorites ?? false,
        favoriteActKeys: me?.shareFavorites ? me.favoriteActKeys : [],
      });
      navigate(`/squad/${id}/plan?day=${encodeURIComponent(day)}`, { replace: true });
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <StackHeader title={range} backTo={`/squad/${id}/plan?day=${encodeURIComponent(day ?? "")}`} />
      <div className="screen squad-block-detail">
        <div className="block-day-label label">{day ? titleCase(day) : ""}</div>

        <section className="glass block-pick">
          <div className="label">Squad is going to</div>
          <div className="block-pick-row">
            <span className="dot dot-lg" style={{ background: stageColor(winner.stageName) }} />
            <div className="block-pick-main">
              <div className="poster block-pick-name">{winner.label}</div>
              <div className="block-pick-meta">
                {winner.stageName} · {methodLabel(block, plan.memberCount)}
              </div>
            </div>
          </div>
          {block.going.length > 0 && (
            <div className="block-pick-avatars">
              <AvatarStack members={block.going} max={6} size={32} />
            </div>
          )}
        </section>

        {block.split.length > 0 && (
          <>
            <div className="block-split-head">
              <div className="label block-split-label">The split</div>
              <button
                className="block-split-view"
                onClick={() => navigate(`/squad/${id}/plan/${perfId}/split?day=${encodeURIComponent(day ?? "")}`)}
              >
                See who's where
                <span className="ms" style={{ fontSize: 15 }}>arrow_forward</span>
              </button>
            </div>
            <div className="block-split">
              {block.split.map((g) => {
                const mine = block.yourLock?.id === g.set.id;
                return (
                  <div className={`glass block-split-row${mine ? " mine" : ""}`} key={g.set.id}>
                    <span className="dot" style={{ background: stageColor(g.set.stageName) }} />
                    <span className="block-split-name">
                      {g.set.label} · {g.set.stageName}
                      {mine && <span className="block-you"> · you</span>}
                    </span>
                    <AvatarStack members={g.members} max={3} size={26} />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {conflict && (
          <div className="glass block-locked-note">
            <span className="ms">lock</span>
            <div>
              You're <b>locked on {block.yourLock?.label}</b> here. We won't change your plan — your
              call.
            </div>
          </div>
        )}

        {block.fallback && (
          <div className="block-fallback">
            <div className="block-fallback-head">
              <span className="ms">favorite</span>
              You also ❤ one near the squad
            </div>
            <div className="block-fallback-row">
              <span className="dot" style={{ background: stageColor(block.fallback.set.stageName) }} />
              <div className="block-fallback-main">
                <div className="block-fallback-name">
                  {block.fallback.set.label} · {block.fallback.set.stageName}
                </div>
                <div className="block-fallback-sub">
                  {block.fallback.friendsThere > 0
                    ? `${block.fallback.friendsThere} ${block.fallback.friendsThere === 1 ? "friend" : "friends"} there`
                    : "your favorite this block"}
                </div>
              </div>
              <button className="chip chip-accent" disabled={busy} onClick={() => void joinSet(block.fallback!.set)}>
                Go {shortName(block.fallback.set.label)}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="squad-actions block-actions">
        {conflict ? (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={() => void joinSet(winner)}>
              <span className="ms">groups</span>
              Join squad → {shortName(winner.label)}
            </button>
            <div className="block-actions-row">
              <button className="btn btn-ghost" disabled={busy} onClick={() => navigate(`/squad/${id}/plan?day=${encodeURIComponent(day ?? "")}`)}>
                Keep my lock
              </button>
              {isOwner && (
                <button className="btn btn-ghost" onClick={() => navigate(overrideHref(id, perfId, day))}>
                  <span className="ms">edit</span>
                  Override
                </button>
              )}
            </div>
            <p className="block-actions-note">We never change a locked pick automatically.</p>
          </>
        ) : isOwner ? (
          <button className="btn btn-ghost" onClick={() => navigate(overrideHref(id, perfId, day))}>
            <span className="ms">edit</span>
            Override squad pick
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => navigate(`/squad/${id}/plan?day=${encodeURIComponent(day ?? "")}`)}>
            Back to squad plan
          </button>
        )}
      </div>
    </>
  );
}

function overrideHref(id: string | undefined, perfId: string | undefined, day: string | undefined): string {
  return `/squad/${id}/plan/${perfId}/override?day=${encodeURIComponent(day ?? "")}`;
}

function titleCase(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

/** First token of an act label (keeps the CTA short, e.g. "Charlotte de Witte" → "Charlotte"). */
function shortName(label: string): string {
  return label.split(/\s+/)[0] ?? label;
}
