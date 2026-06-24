import { useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { initialsOf, useIdentity } from "../data/identity";

interface Props {
  eyebrow?: string;
  title: string;
  /** Override the avatar initials (defaults to the signed-in user's — DEC-032). */
  avatarInitial?: string;
  right?: ReactNode;
}

/**
 * The default top bar. When no custom `right` is given, the avatar shows the real user's initials
 * (not a hardcoded letter) and opens a small profile menu — Profile / Settings — instead of jumping
 * straight to Settings (R9.6). Screens that need a bespoke action pass their own `right`.
 */
export function AppHeader({ eyebrow, title, avatarInitial, right }: Props): JSX.Element {
  const navigate = useNavigate();
  const { user } = useIdentity();
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = avatarInitial ?? initialsOf(user?.displayName);
  // A real avatar photo (DEC-059) replaces the initial when set; custom `avatarInitial` callers
  // (which pass a non-user glyph) keep their initial.
  const photoUrl = avatarInitial ? null : user?.avatarUrl;

  const go = (target: string): void => {
    setMenuOpen(false);
    navigate(target);
  };

  return (
    <header className="appbar">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="poster">{title}</h1>
      </div>
      {right ?? (
        <div className="ava-menu-wrap">
          <button
            className="ava"
            aria-label="Profile & settings"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {photoUrl ? <img className="ava-img" src={photoUrl} alt="Your avatar" /> : initial}
          </button>
          {menuOpen && (
            <>
              <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="ava-menu" role="menu">
                <button role="menuitem" className="ava-menu-item" onClick={() => go("/squad/profile")}>
                  <span className="ms">person</span> Profile
                </button>
                <button role="menuitem" className="ava-menu-item" onClick={() => go("/settings")}>
                  <span className="ms">settings</span> Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
