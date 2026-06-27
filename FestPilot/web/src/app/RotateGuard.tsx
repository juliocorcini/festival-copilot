/**
 * Portrait-only guard (E02 / DEC-089).
 *
 * The manifest declares `orientation: "portrait"` (honored by installed Android PWAs), but iOS PWAs
 * ignore the manifest orientation, so the lock has to be layout-side. This overlay is always in the
 * DOM and toggled purely by a CSS media query (`.rotate-guard`, see styles.css) that matches only a
 * phone-sized landscape viewport with a coarse pointer — so desktop/web (also "landscape") is never
 * blocked. The copy is i18n'd (never hardcoded), with a universal rotate glyph.
 */
import { useT } from "../i18n";

export function RotateGuard(): JSX.Element {
  const t = useT();
  return (
    <div className="rotate-guard" role="alert">
      <span className="ms" aria-hidden="true">
        screen_rotation
      </span>
      <p className="rotate-guard-title">{t("app.rotatePortrait")}</p>
      <p className="rotate-guard-sub">{t("app.rotatePortraitSub")}</p>
    </div>
  );
}
