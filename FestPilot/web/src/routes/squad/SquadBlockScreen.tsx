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
import { api, slotToShareInput } from "../../data/api";
import { useGroup } from "../../data/groups";
import { setPlan, loadStore, saveStore } from "../../data/localStore";
import { useSquadPlan } from "../../data/squadPlan";
import type { SquadBlock } from "../../domain/squadPlan";
import type { PlannableSet, PlanSlot } from "../../domain/types";
import { stageColor, timeInZone } from "../../lib/format";
import { useT } from "../../i18n";
import { ErrorState, LoadingState } from "../../ui/states";
import { AvatarStack, methodLabel } from "./squadUi";
import { WhyThisSheet } from "./WhyThisSheet";

export function SquadBlockScreen(): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { id, perfId } = useParams<{ id: string; perfId: string }>();
  const [params] = useSearchParams();
  const day = params.get("day") ?? undefined;
  const { group } = useGroup(id);
  const { plan, raw, timezone, status, reload } = useSquadPlan(id, day);
  const [busy, setBusy] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

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
        <StackHeader title={t("block.title")} backTo={`/squad/${id}/plan`} />
        <ErrorState message={t("block.gone")} onRetry={reload} />
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
        lateStartMs: null,
      };
      const next = [...kept, newSlot].sort((a, b) => a.startMs - b.startMs);
      saveStore(setPlan(loadStore(), festivalId, day, next));
      await api.shareMyPlan(id, {
        day,
        slots: next.map(slotToShareInput),
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
          <div className="label">{t("block.goingTo")}</div>
          <div className="block-pick-row">
            <span className="dot dot-lg" style={{ background: stageColor(winner.stageName) }} />
            <div className="block-pick-main">
              <div className="poster block-pick-name">{winner.label}</div>
              <div className="block-pick-meta">
                {winner.stageName} · {methodLabel(block, plan.memberCount, t)}
              </div>
            </div>
            <button className="block-why" onClick={() => setShowWhy(true)}>
              <span className="ms" aria-hidden="true">help</span>
              {t("block.whyThis")}
            </button>
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
              <div className="label block-split-label">{t("block.split")}</div>
              <button
                className="block-split-view"
                onClick={() => navigate(`/squad/${id}/plan/${perfId}/split?day=${encodeURIComponent(day ?? "")}`)}
              >
                {t("block.seeWhere")}
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
                      {mine && <span className="block-you"> · {t("common.you")}</span>}
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
            <div>{t("block.lockedNote", { label: block.yourLock?.label ?? t("squad.elsewhere") })}</div>
          </div>
        )}

        {block.fallback && (
          <div className="block-fallback">
            <div className="block-fallback-head">
              <span className="ms">favorite</span>
              {t("block.alsoLove")}
            </div>
            <div className="block-fallback-row">
              <span className="dot" style={{ background: stageColor(block.fallback.set.stageName) }} />
              <div className="block-fallback-main">
                <div className="block-fallback-name">
                  {block.fallback.set.label} · {block.fallback.set.stageName}
                </div>
                <div className="block-fallback-sub">
                  {block.fallback.friendsThere > 0
                    ? t(block.fallback.friendsThere === 1 ? "block.friendThere" : "block.friendsThere", {
                        count: block.fallback.friendsThere,
                      })
                    : t("block.yourFav")}
                </div>
              </div>
              <button className="chip chip-accent" disabled={busy} onClick={() => void joinSet(block.fallback!.set)}>
                {t("block.goName", { name: shortName(block.fallback.set.label) })}
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
              {t("block.joinSquad", { name: shortName(winner.label) })}
            </button>
            <div className="block-actions-row">
              <button className="btn btn-ghost" disabled={busy} onClick={() => navigate(`/squad/${id}/plan?day=${encodeURIComponent(day ?? "")}`)}>
                {t("block.keepLock")}
              </button>
              {isOwner && (
                <button className="btn btn-ghost" onClick={() => navigate(overrideHref(id, perfId, day))}>
                  <span className="ms">edit</span>
                  {t("block.override")}
                </button>
              )}
            </div>
            <p className="block-actions-note">{t("block.neverChange")}</p>
          </>
        ) : isOwner ? (
          <button className="btn btn-ghost" onClick={() => navigate(overrideHref(id, perfId, day))}>
            <span className="ms">edit</span>
            {t("block.overridePick")}
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => navigate(`/squad/${id}/plan?day=${encodeURIComponent(day ?? "")}`)}>
            {t("block.backToPlan")}
          </button>
        )}
      </div>

      {showWhy && <WhyThisSheet block={block} members={plan.members} onClose={() => setShowWhy(false)} />}
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
