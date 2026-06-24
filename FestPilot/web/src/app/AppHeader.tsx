import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  /** Initials shown in the avatar entry to the Settings stack (no 6th tab — DEC-032). */
  avatarInitial?: string;
  right?: ReactNode;
}

export function AppHeader({ eyebrow, title, avatarInitial = "J", right }: Props): JSX.Element {
  const navigate = useNavigate();
  return (
    <header className="appbar">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="poster">{title}</h1>
      </div>
      {right ?? (
        <button className="ava" aria-label="Settings & profile" onClick={() => navigate("/settings")}>
          {avatarInitial}
        </button>
      )}
    </header>
  );
}
