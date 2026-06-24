/**
 * Create squad (#23.4 / B1.4). Name + emoji; the festival is locked to the one the user onboarded
 * (V1 is single-festival — DEC-038). The caller becomes owner and an invite token is minted server
 * side, so we go straight to the invite screen. Squad cap is 50 (enforced server-side; shown here).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useOnboarding } from "../../data/localStore";

const EMOJI_CHOICES = ["🔥", "🎉", "🫶", "🌈", "⚡", "🎶", "💃", "🚀"] as const;

/** Keep the squad glyph to a single grapheme so a custom emoji (incl. ZWJ/skin-tone) stays one symbol. */
function firstEmoji(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(undefined, { granularity: "grapheme" });
    const first = seg.segment(trimmed)[Symbol.iterator]().next();
    return first.done ? trimmed : (first.value as { segment: string }).segment;
  }
  return [...trimmed][0] ?? "";
}

export function CreateSquadScreen(): JSX.Element {
  const navigate = useNavigate();
  const { onboarding } = useOnboarding();
  const [festivalName, setFestivalName] = useState<string>("Your festival");
  const [emoji, setEmoji] = useState<string>(EMOJI_CHOICES[0]);
  const [showPalette, setShowPalette] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Festival name only — a small, fast read (not the heavy lineup) so the locked card is correct.
  useEffect(() => {
    const controller = new AbortController();
    api
      .listFestivals(controller.signal)
      .then((list) => {
        const match = list.find((f) => f.id === onboarding?.festivalId) ?? list[0];
        if (match) setFestivalName(match.name);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [onboarding?.festivalId]);

  const festivalLine = "Locked to your festival";

  const canCreate = name.trim().length >= 2 && Boolean(onboarding?.festivalId) && !busy;

  const create = async (): Promise<void> => {
    if (!canCreate || !onboarding) return;
    setBusy(true);
    setError(false);
    try {
      const group = await api.createGroup({
        name: name.trim(),
        emoji,
        festivalId: onboarding.festivalId,
      });
      navigate(`/squad/invite/${group.id}`, { replace: true });
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <>
      <StackHeader title="Create squad" backTo="/squad" />
      <div className="screen">
        <div style={{ padding: "2px 2px 4px" }}>
          <h1 className="poster" style={{ fontSize: 30, lineHeight: 1.05, margin: 0 }}>
            Create your squad
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
            You'll be the owner — invite friends in the next step.
          </p>
        </div>

        <span className="label">Squad name</span>
        <div className="create-name-row">
          <div className="emoji-pick">
            <button
              type="button"
              className="emoji-btn glass"
              aria-label="Choose squad emoji"
              onClick={() => setShowPalette((s) => !s)}
            >
              {emoji}
            </button>
            {showPalette && (
              <div className="emoji-palette glass" role="listbox" aria-label="Squad emoji">
                <div className="emoji-grid">
                  {EMOJI_CHOICES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className={`emoji-opt${e === emoji ? " on" : ""}`}
                      aria-label={`Emoji ${e}`}
                      onClick={() => {
                        setEmoji(e);
                        setShowPalette(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <label className="emoji-custom">
                  <span className="label" style={{ marginTop: 0 }}>
                    Or type your own
                  </span>
                  <input
                    className="field emoji-custom-input"
                    value={emoji}
                    maxLength={8}
                    inputMode="text"
                    aria-label="Custom squad emoji"
                    placeholder="🎪"
                    onChange={(e) => setEmoji(firstEmoji(e.target.value))}
                  />
                </label>
              </div>
            )}
          </div>
          <input
            id="squad-name"
            className="field"
            value={name}
            maxLength={60}
            placeholder="FAM JUNTOS"
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <span className="label" style={{ marginTop: 22 }}>
          Festival
        </span>
        <div className="glass festival-lock">
          <div className="festival-lock-icon">
            <span className="ms">festival</span>
          </div>
          <div className="festival-lock-main">
            <div className="poster festival-lock-name">{festivalName}</div>
            <div className="festival-lock-sub">{festivalLine}</div>
          </div>
          <span className="ms" style={{ color: "var(--muted)", fontSize: 18 }}>
            lock
          </span>
        </div>

        <div className="glass info-note" style={{ marginTop: 18 }}>
          <span className="ms" style={{ color: "var(--accent)", fontSize: 18 }}>
            groups
          </span>
          <div>
            Members share their locked plan so the squad can build a shared timetable. Up to{" "}
            <b style={{ color: "var(--ink)" }}>50</b> people.
          </div>
        </div>

        {error && (
          <p className="squad-note" style={{ color: "var(--danger)" }}>
            Could not create the squad. Check your connection and try again.
          </p>
        )}
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={create} disabled={!canCreate}>
          <span className="ms">add</span>
          {busy ? "Creating…" : "Create squad"}
        </button>
      </div>
    </>
  );
}
