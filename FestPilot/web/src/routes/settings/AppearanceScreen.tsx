import { StackHeader } from "../../app/StackHeader";
import { useAppearance, useLanguage, type AppearanceMode, type Language } from "../../app/settings";
import { useT, type MessageKey } from "../../i18n";

const APPEARANCE: { id: AppearanceMode; label: MessageKey; hint: MessageKey }[] = [
  { id: "auto", label: "appearance.auto", hint: "appearance.autoHint" },
  { id: "day", label: "appearance.day", hint: "appearance.dayHint" },
  { id: "night", label: "appearance.night", hint: "appearance.nightHint" },
];

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
];

export function AppearanceScreen(): JSX.Element {
  const t = useT();
  const { mode, setMode, palette } = useAppearance();
  const { language, setLanguage } = useLanguage();
  const activeHint = APPEARANCE.find((o) => o.id === mode)?.hint ?? "appearance.autoHint";

  return (
    <>
      <StackHeader title={t("settings.appearanceLang")} backTo="/settings" />
      <div className="screen">
        <section className="glass" style={{ padding: 16 }}>
          <span className="label">{t("appearance.appearance")}</span>
          <div className="seg" style={{ marginTop: 12, width: "100%", display: "flex" }}>
            {APPEARANCE.map((opt) => (
              <button
                key={opt.id}
                className={mode === opt.id ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => setMode(opt.id)}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
          <p className="row-sub" style={{ marginTop: 10 }}>
            {t("appearance.hintLine", { hint: t(activeHint), palette: t(`palette.${palette}`) })}
          </p>
        </section>

        <section className="glass" style={{ padding: 16 }}>
          <span className="label">{t("appearance.language")}</span>
          <div className="seg" style={{ marginTop: 12, width: "100%", display: "flex" }}>
            {LANGUAGES.map((opt) => (
              <button
                key={opt.id}
                className={language === opt.id ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => setLanguage(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="row-sub" style={{ marginTop: 10 }}>
            {t("appearance.languageNote")}
          </p>
        </section>
      </div>
    </>
  );
}
