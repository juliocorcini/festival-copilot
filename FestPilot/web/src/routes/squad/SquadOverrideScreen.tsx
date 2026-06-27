/**
 * Owner override (#24.4). The owner pins any act playing in a block's window as the squad pick
 * (method = owner). The auto (plurality) pick is marked; members can still "do my own"; the owner
 * can revert to auto. Owner-gated on the server too.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useSquadPlan } from "../../data/squadPlan";
import type { PlannableSet } from "../../domain/types";
import { stageColor } from "../../lib/format";
import { useT } from "../../i18n";
import { ErrorState, LoadingState } from "../../ui/states";

function overlaps(a: PlannableSet, b: PlannableSet): boolean {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}

export function SquadOverrideScreen(): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { id, perfId } = useParams<{ id: string; perfId: string }>();
  const [params] = useSearchParams();
  const day = params.get("day") ?? undefined;
  const { group } = useGroup(id);
  const { raw, daySets, status, reload } = useSquadPlan(id, day);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const target = useMemo(() => daySets.find((s) => s.id === perfId) ?? null, [daySets, perfId]);

  // How many members locked each set (the "N picked" counts).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const member of raw?.members ?? []) {
      for (const pid of member.performanceIds) m.set(pid, (m.get(pid) ?? 0) + 1);
    }
    return m;
  }, [raw]);

  const candidates = useMemo(() => {
    if (!target) return [];
    return daySets
      .filter((s) => overlaps(s, target))
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.startMs - b.startMs);
  }, [daySets, target, counts]);

  const autoPickId = useMemo(() => {
    const top = candidates.find((c) => (counts.get(c.id) ?? 0) > 0);
    return top?.id ?? candidates[0]?.id ?? null;
  }, [candidates, counts]);

  const pinnedId = useMemo(
    () => candidates.find((c) => (raw?.overrides ?? []).includes(c.id))?.id ?? null,
    [candidates, raw]
  );

  const current = selected ?? pinnedId ?? autoPickId;

  if (group && group.role !== "owner") {
    return (
      <>
        <StackHeader title={t("override.title")} backTo={`/squad/${id}/plan`} />
        <ErrorState title={t("override.ownerOnlyTitle")} message={t("override.ownerOnlyMsg")} />
      </>
    );
  }
  if (status === "loading") return <LoadingState rows={4} />;
  if (status === "error" || !target || !id) {
    return (
      <>
        <StackHeader title={t("override.title")} backTo={`/squad/${id}/plan`} />
        <ErrorState message={t("override.loadError")} onRetry={reload} />
      </>
    );
  }

  const filtered = candidates.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()));
  const revertingToAuto = current === autoPickId;

  const apply = async (): Promise<void> => {
    if (!day || !current || busy) return;
    setBusy(true);
    try {
      for (const o of raw?.overrides ?? []) {
        if (candidates.some((c) => c.id === o)) await api.clearSquadOverride(id, day, o);
      }
      if (!revertingToAuto) await api.setSquadOverride(id, day, current);
      navigate(`/squad/${id}/plan?day=${encodeURIComponent(day)}`, { replace: true });
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <StackHeader title={t("override.setPick")} backTo={`/squad/${id}/plan/${perfId}?day=${encodeURIComponent(day ?? "")}`} />
      <div className="screen squad-override">
        <div className="override-head">
          <span className="label">{t("override.dayLabel", { day: day ? titleCase(day) : "" })}</span>
          <span className="chip chip-accent-soft">{t("squad.owner")}</span>
        </div>

        <div className="override-search">
          <span className="ms">search</span>
          <input
            className="field"
            placeholder={t("override.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="override-list">
          {filtered.map((c) => {
            const n = counts.get(c.id) ?? 0;
            const on = c.id === current;
            const isAuto = c.id === autoPickId;
            return (
              <button
                key={c.id}
                className={`glass override-row${on ? " on" : ""}`}
                onClick={() => setSelected(c.id)}
              >
                <span className="dot" style={{ background: stageColor(c.stageName) }} />
                <div className="override-main">
                  <div className="override-name">{c.label}</div>
                  <div className="override-sub">
                    {c.stageName}
                    {isAuto ? ` · ${t("override.autoPick")}` : ""} · {t("override.nPicked", { count: n })}
                  </div>
                </div>
                <span className="ms override-radio">{on ? "radio_button_checked" : "radio_button_unchecked"}</span>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="override-empty">{t("override.noMatch", { query })}</div>}
        </div>

        <div className="glass override-note">
          <span className="ms">info</span>
          <div>{t("override.note")}</div>
        </div>
      </div>

      <div className="squad-actions">
        <button className="btn btn-primary" onClick={apply} disabled={busy || !current}>
          <span className="ms">{revertingToAuto ? "restart_alt" : "push_pin"}</span>
          {busy ? t("override.saving") : revertingToAuto ? t("override.revert") : t("override.setAsPick")}
        </button>
      </div>
    </>
  );
}

function titleCase(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}
