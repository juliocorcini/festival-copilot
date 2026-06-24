/**
 * B6.5 offline & data (G3.3 offline contract, DEC-022). Surfaces connectivity + what's actually
 * cached for no-signal use (lineup, venue map, map art) and a one-tap "Make available offline" that
 * primes those caches via the service worker. The plan/favorites are local-first (DEC-041), so they
 * already work offline and aren't listed here.
 */
import { useCallback, useEffect, useState } from "react";
import { StackHeader } from "../../app/StackHeader";
import { useLineup } from "../../data/useLineup";
import { getOfflineStatus, primeOffline, type OfflineStatus } from "../../data/offline";

type SaveState = "idle" | "saving" | "saved";

export function OfflineScreen(): JSX.Element {
  const { lineup } = useLineup();
  const festivalId = lineup?.festival.id ?? null;

  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installed, setInstalled] = useState<boolean>(false);
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [save, setSave] = useState<SaveState>("idle");

  const refresh = useCallback(() => {
    void getOfflineStatus(festivalId).then(setStatus);
  }, [festivalId]);

  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const makeOffline = async (): Promise<void> => {
    if (!festivalId) return;
    setSave("saving");
    const next = await primeOffline(festivalId);
    setStatus(next);
    setSave("saved");
    window.setTimeout(() => setSave("idle"), 2400);
  };

  const reload = (): void => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).finally(() => location.reload());
    } else {
      location.reload();
    }
  };

  const allReady = Boolean(status?.lineup && status?.map && status?.art);

  return (
    <>
      <StackHeader title="Offline & data" backTo="/settings" />
      <div className="screen">
        <section className="glass" style={{ overflow: "hidden" }}>
          <div className="row">
            <span className="ms" style={{ color: online ? "var(--ok-ink)" : "var(--muted)" }}>
              {online ? "wifi" : "wifi_off"}
            </span>
            <span className="row-main">
              <span className="row-title">Connection</span>
              <span className="row-sub">{online ? "Online" : "Offline — showing cached data"}</span>
            </span>
            <span className={`pill ${online ? "ok" : ""}`}>{online ? "Live" : "Cached"}</span>
          </div>
          <div className="row">
            <span className="ms">install_mobile</span>
            <span className="row-main">
              <span className="row-title">Installed app</span>
              <span className="row-sub">
                {installed ? "Running as an installed app" : "Add to Home Screen for offline use"}
              </span>
            </span>
          </div>
        </section>

        <section className="glass" style={{ overflow: "hidden" }}>
          <OfflineRow icon="event_note" title="Lineup" ready={status?.lineup} supported={status?.supported} />
          <OfflineRow icon="map" title="Venue map" ready={status?.map} supported={status?.supported} />
          <OfflineRow icon="imagesmode" title="Map artwork" ready={status?.art} supported={status?.supported} />
        </section>

        {status?.supported === false ? (
          <p className="src" style={{ textAlign: "center" }}>
            Offline storage isn’t available in this browser context. Install the app to cache for no-signal use.
          </p>
        ) : (
          <button
            className={`btn ${allReady ? "btn-ghost" : "btn-primary"}`}
            disabled={save === "saving" || !festivalId}
            onClick={() => void makeOffline()}
          >
            <span className="ms">{save === "saved" ? "check_circle" : "cloud_download"}</span>
            {save === "saving" ? "Saving…" : save === "saved" ? "Saved for offline" : allReady ? "Refresh offline data" : "Make available offline"}
          </button>
        )}

        <button className="btn btn-ghost" onClick={reload}>
          <span className="ms">refresh</span> Check for updates
        </button>
        <p className="src" style={{ textAlign: "center" }}>
          FestPilot caches the app, the venue map and the lineup so the essentials work on a packed field with no signal.
        </p>
      </div>
    </>
  );
}

function OfflineRow({
  icon,
  title,
  ready,
  supported,
}: {
  icon: string;
  title: string;
  ready: boolean | undefined;
  supported: boolean | undefined;
}): JSX.Element {
  const state = supported === false ? "—" : ready ? "Ready" : "Not saved";
  return (
    <div className="row">
      <span className="ms" style={{ color: ready ? "var(--ok-ink)" : "var(--muted)" }}>{icon}</span>
      <span className="row-main">
        <span className="row-title">{title}</span>
        <span className="row-sub">{ready ? "Available offline" : "Will cache when you save"}</span>
      </span>
      <span className={`pill ${ready ? "ok" : ""}`}>{state}</span>
    </div>
  );
}
