/**
 * Proactive "new version available" banner (R10.2). It listens for the update-ready signal emitted
 * by the service-worker layer (a waiting worker, or a deployed shell that no longer matches this
 * tab's bundle) and offers a one-tap update from anywhere in the app. Tapping it `forceUpdate()`s to
 * the latest build; "Later" dismisses it for this session (it returns on the next launch/check).
 */
import { useEffect, useState } from "react";
import { forceUpdate, onUpdateReady } from "./registerSW";
import { useT } from "../i18n";

export function UpdateBanner(): JSX.Element | null {
  const t = useT();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => onUpdateReady(() => setReady(true)), []);

  if (!ready || dismissed) return null;

  const update = (): void => {
    setUpdating(true);
    void forceUpdate();
  };

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <span className="ms update-banner-icon" aria-hidden="true">rocket_launch</span>
      <span className="update-banner-text">{t("update.bannerTitle")}</span>
      <button className="update-banner-btn" data-haptic="medium" disabled={updating} onClick={update}>
        {updating ? t("update.forcing") : t("update.now")}
      </button>
      <button className="update-banner-x" aria-label={t("update.later")} onClick={() => setDismissed(true)}>
        <span className="ms" aria-hidden="true">close</span>
      </button>
    </div>
  );
}
