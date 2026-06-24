/**
 * Profile setup (#23.3 / B1.3, B5.3). Asked at first join (DEC-039): display name + avatar.
 * V1 avatar = initials on a chosen "dot colour" (also the map presence dot in Phase 5). Photo
 * upload needs R2 (out for V1, DEC-038), so initials are the shipped path.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { DOT_COLORS, initialsOf, useIdentity } from "../../data/identity";
import { useProfile } from "../../data/localStore";

export function ProfileScreen(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/squad";
  const { user, ensure, updateProfile, loading } = useIdentity();
  const { profile } = useProfile();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DOT_COLORS[0]);

  useEffect(() => {
    if (!user) void ensure();
  }, [user, ensure]);

  // Prefill from the server profile, falling back to the name captured at onboarding (DEC-060).
  useEffect(() => {
    if (user?.displayName) setName(user.displayName);
    else if (profile?.name) setName(profile.name);
    if (user?.avatarColor) setColor(user.avatarColor);
  }, [user, profile]);

  const canSave = name.trim().length >= 2 && !loading;

  const save = async (): Promise<void> => {
    if (!canSave) return;
    const saved = await updateProfile({ displayName: name.trim(), avatarColor: color });
    if (saved) navigate(next, { replace: true });
  };

  const initials = initialsOf(name) === "?" ? "JU" : initialsOf(name);

  return (
    <>
      <StackHeader title="Your profile" backTo="/squad" />
      <div className="screen">
        <div style={{ padding: "2px 2px 4px" }}>
          <h1 className="poster" style={{ fontSize: 28, lineHeight: 1.05, margin: 0 }}>
            How should the
            <br />
            squad see you?
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>
            This is your name &amp; avatar in presence and on the map.
          </p>
        </div>

        <div className="profile-ava-wrap">
          <div
            className="profile-ava"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
            aria-label="Avatar preview"
          >
            {initials}
          </div>
        </div>

        <label className="label" htmlFor="display-name">
          Display name
        </label>
        <input
          id="display-name"
          className="field"
          value={name}
          maxLength={40}
          placeholder="Your name"
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />

        <span className="label" style={{ marginTop: 14 }}>
          Your dot color
        </span>
        <div className="dot-picker">
          {DOT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`dot-swatch${c === color ? " on" : ""}`}
              style={{ background: c, color: c }}
              aria-label={`Color ${c}`}
              aria-pressed={c === color}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={save} disabled={!canSave}>
          {loading ? "Saving…" : "Continue"}
        </button>
      </div>
    </>
  );
}
