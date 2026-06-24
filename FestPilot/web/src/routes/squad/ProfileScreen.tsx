/**
 * Profile setup (#23.3 / B1.3, B5.3). Asked at first join (DEC-039): display name + avatar.
 * The avatar is a real photo on R2 (DEC-059) when set, falling back to initials on a chosen
 * "dot colour" (also the map presence dot in Phase 5). The photo is client-compressed (~150 KB)
 * before upload; the server enforces the app quota and rejects oversize/wrong-type honestly.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { DOT_COLORS, initialsOf, useIdentity } from "../../data/identity";
import { useProfile } from "../../data/localStore";
import { compressAvatar } from "../../ui/imageCompress";

export function ProfileScreen(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/squad";
  const { user, ensure, updateProfile, uploadAvatar, removeAvatar, loading } = useIdentity();
  const { profile } = useProfile();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DOT_COLORS[0]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const pickPhoto = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      // Compress in the browser first (DEC-059 ~150 KB target), then upload the raw bytes.
      const { blob } = await compressAvatar(file);
      await uploadAvatar(blob);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const dropPhoto = async (): Promise<void> => {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await removeAvatar();
    } finally {
      setPhotoBusy(false);
    }
  };

  const initials = initialsOf(name) === "?" ? "JU" : initialsOf(name);
  const photoUrl = user?.avatarUrl ?? null;

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
          <button
            type="button"
            className="profile-ava-btn"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            aria-label={photoUrl ? "Change profile photo" : "Add a profile photo"}
          >
            {photoUrl ? (
              <img className="profile-ava profile-ava-img" src={photoUrl} alt="Your avatar" />
            ) : (
              <div
                className="profile-ava"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
              >
                {initials}
              </div>
            )}
            <span className="profile-ava-cam" aria-hidden="true">
              <span className="ms">{photoBusy ? "hourglass_empty" : "photo_camera"}</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <button
            type="button"
            className="profile-ava-action"
            onClick={() => (photoUrl ? void dropPhoto() : fileRef.current?.click())}
            disabled={photoBusy}
          >
            {photoBusy ? "Working…" : photoUrl ? "Remove photo" : "Add a photo"}
          </button>
          {photoError && (
            <p className="squad-note" style={{ color: "var(--danger)", margin: 0 }}>
              {photoError}
            </p>
          )}
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
