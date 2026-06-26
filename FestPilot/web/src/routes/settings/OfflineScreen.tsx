/**
 * B6.5 offline & data (G3.3 offline contract, DEC-022) + PWA install/update (R10.2). Surfaces
 * connectivity + what's actually cached for no-signal use (lineup, venue map, map art) and a one-tap
 * "Make available offline" that primes those caches via the service worker. Also hosts the real
 * install affordance (beforeinstallprompt / iOS instructions / installed state) and an honest
 * "Check for updates" backed by the SW update flow. Plan/favorites are local-first (DEC-041), already
 * offline, so they aren't listed here.
 */
import { useCallback, useEffect, useState } from "react";
import { StackHeader } from "../../app/StackHeader";
import { useLineup } from "../../data/useLineup";
import { useInstallPrompt } from "../../app/pwaInstall";
import { applyUpdate, checkForUpdate, forceUpdate, type UpdateStatus } from "../../app/registerSW";
import { useT, type TranslateFn } from "../../i18n";
import { APP_VERSION } from "../../data/changelog";
import { getOfflineStatus, primeOffline, type OfflineStatus } from "../../data/offline";

type SaveState = "idle" | "saving" | "saved";
type CheckState = "idle" | "checking" | UpdateStatus;

export function OfflineScreen(): JSX.Element {
  const t = useT();
  const { lineup } = useLineup();
  const festivalId = lineup?.festival.id ?? null;

  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [check, setCheck] = useState<CheckState>("idle");

  const refresh = useCallback(() => {
    void getOfflineStatus(festivalId).then(setStatus);
  }, [festivalId]);

  useEffect(() => {
    const up = (): void => setOnline(true);
    const down = (): void => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
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

  const runUpdateCheck = async (): Promise<void> => {
    setCheck("checking");
    setCheck(await checkForUpdate());
  };

  const allReady = Boolean(status?.lineup && status?.map && status?.art);

  return (
    <>
      <StackHeader title={t("settings.offline")} backTo="/settings" />
      <div className="screen">
        <section className="glass" style={{ overflow: "hidden" }}>
          <div className="row">
            <span className="ms" style={{ color: online ? "var(--ok-ink)" : "var(--muted)" }}>
              {online ? "wifi" : "wifi_off"}
            </span>
            <span className="row-main">
              <span className="row-title">{t("offline.connection")}</span>
              <span className="row-sub">{online ? t("offline.online") : t("offline.offline")}</span>
            </span>
            <span className={`pill ${online ? "ok" : ""}`}>{online ? t("offline.live") : t("offline.cached")}</span>
          </div>
          <InstallRow t={t} />
        </section>

        <section className="glass" style={{ overflow: "hidden" }}>
          <OfflineRow icon="event_note" title={t("offline.lineup")} ready={status?.lineup} supported={status?.supported} t={t} />
          <OfflineRow icon="map" title={t("offline.venueMap")} ready={status?.map} supported={status?.supported} t={t} />
          <OfflineRow icon="imagesmode" title={t("offline.mapArt")} ready={status?.art} supported={status?.supported} t={t} />
        </section>

        {status?.supported === false ? (
          <p className="src" style={{ textAlign: "center" }}>{t("offline.unsupported")}</p>
        ) : (
          <button
            className={`btn ${allReady ? "btn-ghost" : "btn-primary"}`}
            disabled={save === "saving" || !festivalId}
            onClick={() => void makeOffline()}
          >
            <span className="ms">{save === "saved" ? "check_circle" : "cloud_download"}</span>
            {save === "saving"
              ? t("offline.saving")
              : save === "saved"
                ? t("offline.saved")
                : allReady
                  ? t("offline.refresh")
                  : t("offline.makeAvailable")}
          </button>
        )}

        <UpdateControl
          t={t}
          check={check}
          onCheck={() => void runUpdateCheck()}
          onApply={() => void applyUpdate()}
          onForce={() => void forceUpdate()}
        />

        <p className="src" style={{ textAlign: "center" }}>{t("offline.blurb")}</p>
      </div>
    </>
  );
}

/** The install affordance — adapts to Chrome/Android (prompt), iOS (instructions), or installed. */
function InstallRow({ t }: { t: TranslateFn }): JSX.Element {
  const { state, promptInstall } = useInstallPrompt();

  if (state === "installable") {
    return (
      <button className="row" style={rowButton} onClick={() => void promptInstall()}>
        <span className="ms">install_mobile</span>
        <span className="row-main">
          <span className="row-title">{t("install.add")}</span>
          <span className="row-sub">{t("install.addSub")}</span>
        </span>
        <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
      </button>
    );
  }

  const sub =
    state === "installed" ? t("install.running") : state === "ios" ? t("install.iosSub") : t("install.unavailableSub");

  return (
    <div className="row">
      <span className="ms" style={{ color: state === "installed" ? "var(--ok-ink)" : undefined }}>install_mobile</span>
      <span className="row-main">
        <span className="row-title">{state === "ios" ? t("install.add") : t("install.title")}</span>
        <span className="row-sub">{sub}</span>
      </span>
      {state === "installed" && <span className="pill ok">{t("install.installed")}</span>}
    </div>
  );
}

/** Honest update check: reports a waiting update (with reload), latest-version, or unsupported. */
function UpdateControl({
  t,
  check,
  onCheck,
  onApply,
  onForce,
}: {
  t: TranslateFn;
  check: CheckState;
  onCheck: () => void;
  onApply: () => void;
  onForce: () => void;
}): JSX.Element {
  if (check === "updated") {
    return (
      <>
        <p className="src" style={{ textAlign: "center", color: "var(--ok-ink)" }}>{t("update.ready")}</p>
        <button className="btn btn-primary" onClick={onApply}>
          <span className="ms">restart_alt</span> {t("update.reload")}
        </button>
      </>
    );
  }

  const message =
    check === "current" ? t("update.current", { version: APP_VERSION }) : check === "unsupported" ? t("update.unsupported") : null;

  return (
    <>
      <button className="btn btn-ghost" disabled={check === "checking"} onClick={onCheck}>
        <span className="ms">refresh</span> {check === "checking" ? t("update.checking") : t("update.check")}
      </button>
      {message && (
        <p className="src" style={{ textAlign: "center" }}>{message}</p>
      )}
      {/* Last-resort: pull the freshest build even when the worker hasn't flagged one (long-open session). */}
      <button className="link-btn" style={{ alignSelf: "center" }} onClick={onForce}>
        <span className="ms" style={{ fontSize: 16 }}>sync</span> {t("update.force")}
      </button>
    </>
  );
}

function OfflineRow({
  icon,
  title,
  ready,
  supported,
  t,
}: {
  icon: string;
  title: string;
  ready: boolean | undefined;
  supported: boolean | undefined;
  t: TranslateFn;
}): JSX.Element {
  const state = supported === false ? "—" : ready ? t("offline.ready") : t("offline.notSaved");
  return (
    <div className="row">
      <span className="ms" style={{ color: ready ? "var(--ok-ink)" : "var(--muted)" }}>{icon}</span>
      <span className="row-main">
        <span className="row-title">{title}</span>
        <span className="row-sub">{ready ? t("offline.availableOffline") : t("offline.willCache")}</span>
      </span>
      <span className={`pill ${ready ? "ok" : ""}`}>{state}</span>
    </div>
  );
}

const rowButton: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  color: "inherit",
};
