/**
 * Share my plan (#23.8 / B1.8). The squad sees your locked picks so the group timetable can form;
 * raw favorites stay private unless you opt them in as the fallback (DEC-019). Shares every day you
 * have a locked plan for in one action, then routes into the squad plan.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api, slotToShareInput } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useFavorites, usePlan, loadStore } from "../../data/localStore";
import { useLineup } from "../../data/useLineup";
import { stageColor, timeInZone } from "../../lib/format";
import { toast } from "../../lib/toast";
import { ErrorState, LoadingState } from "../../ui/states";

export function ShareMyPlanScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  // Reached as the one-time auto-share confirm right after joining (DEC-054, R9.4).
  const justJoined = params.get("joined") === "1";
  const { group, status } = useGroup(id);
  const lineup = useLineup();
  const festivalId = group?.festivalId;
  const favorites = useFavorites(festivalId);

  const [shareLocked, setShareLocked] = useState(true);
  const [shareFav, setShareFav] = useState(true);
  const [busy, setBusy] = useState(false);

  // Days the user has a locked plan for (local-first store, DEC-041).
  const myDays = useMemo<string[]>(() => {
    if (!festivalId) return [];
    const prefix = `${festivalId}:`;
    return Object.keys(loadStore().plans)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }, [festivalId]);

  const previewDay = myDays[0];
  const preview = usePlan(festivalId, previewDay);
  const tz = lineup.lineup?.festival.timezone ?? "Europe/Brussels";

  if (status === "loading") return <LoadingState rows={3} />;
  if (status === "error" || !group || !id) {
    return (
      <>
        <StackHeader title="Share my plan" backTo="/squad" />
        <ErrorState message="Could not load this squad. Try again." />
      </>
    );
  }

  const previewSlots = [...(preview.plan?.slots ?? [])].sort((a, b) => a.startMs - b.startMs);
  const hasPlan = myDays.length > 0;
  const canShare = (shareLocked && hasPlan) || (shareFav && favorites.count > 0);

  const share = async (): Promise<void> => {
    if (!canShare || busy) return;
    setBusy(true);
    try {
      const favoriteActKeys = shareFav ? [...favorites.keys] : [];
      const store = loadStore();
      const daysToShare = shareLocked ? myDays : [];
      if (daysToShare.length === 0) {
        // Favorites-only share: register intent against the first festival day we know.
        const fallbackDay = previewDay ?? "ALL";
        await api.shareMyPlan(id, { day: fallbackDay, slots: [], shareFavorites: shareFav, favoriteActKeys });
      } else {
        for (const day of daysToShare) {
          const slots = (store.plans[`${festivalId}:${day}`]?.slots ?? []).map(slotToShareInput);
          await api.shareMyPlan(id, { day, slots, shareFavorites: shareFav, favoriteActKeys });
        }
      }
      toast.success("Plan shared with your squad");
      navigate(`/squad/${id}/plan`, { replace: true });
    } catch {
      toast.error("Couldn't share your plan. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <StackHeader title={justJoined ? "You're in!" : "Share my plan"} backTo="/squad" />
      <div className="screen share-plan">
        <div className="share-intro">
          <h1 className="poster">
            Share your plan
            <br />
            with {group.emoji ? `${group.emoji} ` : ""}
            {group.name}
          </h1>
          <p>
            {justJoined
              ? "Welcome to the squad! Sharing your plan + favorites lets everyone build the group timetable. You can change this anytime in Settings."
              : "The squad sees your locked picks so the group plan can form. Your raw favorites stay private unless used as a fallback."}
          </p>
        </div>

        <div className="glass share-toggles">
          <button className="share-toggle" onClick={() => setShareLocked((v) => !v)}>
            <span className="ms share-toggle-icon">lock</span>
            <div className="share-toggle-main">
              <div className="share-toggle-title">Share my locked plan</div>
              <div className="share-toggle-sub">Your one-act-per-moment schedule</div>
            </div>
            <span className={`toggle${shareLocked ? " on" : ""}`} role="switch" aria-checked={shareLocked} />
          </button>
          <div className="divider" />
          <button className="share-toggle" onClick={() => setShareFav((v) => !v)}>
            <span className="ms share-toggle-icon">favorite</span>
            <div className="share-toggle-main">
              <div className="share-toggle-title">Use my favorites as fallback</div>
              <div className="share-toggle-sub">When your pick ≠ the group, offer one you also liked</div>
            </div>
            <span className={`toggle${shareFav ? " on" : ""}`} role="switch" aria-checked={shareFav} />
          </button>
        </div>

        <div className="label share-preview-label">
          Preview · what they'll see{previewDay ? ` — ${titleCase(previewDay)}` : ""}
        </div>
        <div className="glass share-preview">
          {previewSlots.length === 0 ? (
            <div className="share-empty">
              <span className="ms">event_busy</span>
              <span>No locked plan yet — lock in your day first to share a real schedule.</span>
            </div>
          ) : (
            previewSlots.map((slot) => (
              <div className="share-row" key={slot.setId}>
                <span className="share-time">{timeInZone(new Date(slot.startMs).toISOString(), tz)}</span>
                <span className="dot" style={{ background: stageColor(slot.stageName) }} />
                <span className="share-act">{slot.label}</span>
                <span className="share-stage">{slot.stageName}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        {!hasPlan && (
          <button className="btn btn-ghost" onClick={() => navigate("/lockin")}>
            <span className="ms">bolt</span>
            Lock in a plan first
          </button>
        )}
        <button className="btn btn-primary" onClick={share} disabled={!canShare || busy}>
          <span className="ms">ios_share</span>
          {busy ? "Sharing…" : "Share with squad"}
        </button>
        {justJoined && (
          <button className="btn btn-ghost" onClick={() => navigate("/squad", { replace: true })}>
            Not now
          </button>
        )}
      </div>
    </>
  );
}

function titleCase(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}
