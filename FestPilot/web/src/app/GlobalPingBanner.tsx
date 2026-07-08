/**
 * Global ping alert (F05 / DEC-112): when another member pings "where is everyone?", this shows a
 * toast banner on ANY screen — not just inside the "Where is everyone" view. Polls the first group's
 * presence inbox every 30s. Dismisses automatically after 15s or on tap (navigates to WhereScreen).
 *
 * Also monitors active safety broadcasts ("I'm lost"). Safety alerts are stronger: persistent (no
 * auto-dismiss), red, with vibration, and navigate to the Safety screen on tap.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../data/api";
import { useMyGroups } from "../data/groups";
import { useIdentity } from "../data/identity";
import { useT } from "../i18n";
import type { MeetingPointDto, PingDto } from "../data/types";

const POLL_MS = 30_000;
const SAFETY_POLL_MS = 15_000;
const DISMISS_MS = 15_000;
const ACTIVE_GROUP_KEY = "fp.active-group";

export function GlobalPingBanner(): JSX.Element | null {
  const { groups } = useMyGroups();
  const identity = useIdentity();
  const navigate = useNavigate();
  const t = useT();
  const [ping, setPing] = useState<PingDto | null>(null);
  const [safetyAlert, setSafetyAlert] = useState<MeetingPointDto | null>(null);
  const seenIds = useRef(new Set<string>());
  const seenSafetyIds = useRef(new Set<string>());
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const groupId = (() => {
    const active = localStorage.getItem(ACTIVE_GROUP_KEY);
    if (active && groups?.some((g) => g.id === active)) return active;
    return groups?.[0]?.id;
  })();

  const poll = useCallback(async () => {
    if (!groupId || !identity) return;
    try {
      const data = await api.getGroupPresence(groupId);
      const unseen = data?.inbox?.find((p) => !seenIds.current.has(p.id));
      if (unseen) {
        seenIds.current.add(unseen.id);
        setPing(unseen);
      }
    } catch { /* best effort */ }
  }, [groupId, identity]);

  const pollSafety = useCallback(async () => {
    if (!groupId || !identity) return;
    try {
      const points = await api.listSafetyPoints(groupId);
      const myId = identity.user?.id;
      const active = points.find((p) => p.createdByUserId !== myId && !seenSafetyIds.current.has(p.id));
      if (active) {
        seenSafetyIds.current.add(active.id);
        setSafetyAlert(active);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
      } else if (!active && safetyAlert) {
        const stillActive = points.some((p) => p.id === safetyAlert.id);
        if (!stillActive) setSafetyAlert(null);
      }
    } catch { /* best effort */ }
  }, [groupId, identity, safetyAlert]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    pollSafety();
    const id = setInterval(pollSafety, SAFETY_POLL_MS);
    return () => clearInterval(id);
  }, [pollSafety]);

  useEffect(() => {
    if (!ping) return;
    dismissTimer.current = setTimeout(() => setPing(null), DISMISS_MS);
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [ping]);

  if (safetyAlert && groupId) {
    const handleSafetyTap = (): void => {
      navigate(`/squad/${groupId}/safety`);
    };
    return (
      <div className="global-ping-banner safety-alert" role="alert" onClick={handleSafetyTap}>
        <span className="ms" aria-hidden="true">emergency</span>
        <span>{t("safety.globalAlert", { name: safetyAlert.createdByName ?? t("where.inboxSomeone") })}</span>
        <button
          className="global-ping-close"
          aria-label={t("common.close")}
          onClick={(e) => { e.stopPropagation(); setSafetyAlert(null); }}
        >
          <span className="ms">close</span>
        </button>
      </div>
    );
  }

  if (!ping || !groupId) return null;

  const handleTap = (): void => {
    setPing(null);
    if (ping.kind === "share_plan") {
      navigate(`/squad/${groupId}/share`);
    } else {
      navigate(`/squad/${groupId}/where`);
    }
  };

  const message = ping.kind === "share_plan"
    ? t("ping.sharePlanRequest", { name: ping.fromName ?? t("where.inboxSomeone") })
    : t(ping.kind === "nudge" ? "where.inboxAskedShare" : "where.inboxAskedWhere", {
        name: ping.fromName ?? t("where.inboxSomeone"),
      });

  const icon = ping.kind === "share_plan" ? "calendar_month" : "person_pin_circle";

  return (
    <div className="global-ping-banner" role="alert" onClick={handleTap}>
      <span className="ms" aria-hidden="true">{icon}</span>
      <span>{message}</span>
      <button
        className="global-ping-close"
        aria-label={t("common.close")}
        onClick={(e) => { e.stopPropagation(); setPing(null); }}
      >
        <span className="ms">close</span>
      </button>
    </div>
  );
}
