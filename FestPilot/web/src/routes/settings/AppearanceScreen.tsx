import { StackHeader } from "../../app/StackHeader";
import { useAppearance, useLanguage, type AppearanceMode, type Language } from "../../app/settings";

const APPEARANCE: { id: AppearanceMode; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Follows the festival clock" },
  { id: "day", label: "Day", hint: "Light map art" },
  { id: "night", label: "Night", hint: "Dark map art" },
];

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
];

export function AppearanceScreen(): JSX.Element {
  const { mode, setMode, palette } = useAppearance();
  const { language, setLanguage } = useLanguage();

  return (
    <>
      <StackHeader title="Appearance & language" backTo="/settings" />
      <div className="screen">
        <section className="glass" style={{ padding: 16 }}>
          <span className="label">Appearance</span>
          <div className="seg" style={{ marginTop: 12, width: "100%", display: "flex" }}>
            {APPEARANCE.map((opt) => (
              <button
                key={opt.id}
                className={mode === opt.id ? "on" : ""}
                style={{ flex: 1 }}
                onClick={() => setMode(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="row-sub" style={{ marginTop: 10 }}>
            {APPEARANCE.find((o) => o.id === mode)?.hint} · currently showing <b>{palette}</b> map.
          </p>
        </section>

        <section className="glass" style={{ padding: 16 }}>
          <span className="label">Language</span>
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
            English is the default. Full translations roll out as screens are built.
          </p>
        </section>
      </div>
    </>
  );
}
