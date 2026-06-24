import { useEffect, useState } from "react";
import { StackHeader } from "../../app/StackHeader";

/** B6.5 offline/sync shell. Real per-festival sync state grows in later phases; this
 * surfaces connectivity, install status, and a manual "reload latest" for the cached app. */
export function OfflineScreen(): JSX.Element {
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installed, setInstalled] = useState<boolean>(false);

  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const reload = (): void => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update()).finally(() => location.reload());
    } else {
      location.reload();
    }
  };

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
          <div className="row">
            <span className="ms">map</span>
            <span className="row-main">
              <span className="row-title">Map &amp; lineup</span>
              <span className="row-sub">Cached on first load for use without signal</span>
            </span>
            <span className="pill ok">Ready</span>
          </div>
        </section>

        <button className="btn btn-ghost" onClick={reload}>
          <span className="ms">refresh</span> Check for updates
        </button>
        <p className="src" style={{ textAlign: "center" }}>
          FestPilot caches the app shell, the venue map, and the lineup so the essentials work on a packed field with no signal.
        </p>
      </div>
    </>
  );
}
