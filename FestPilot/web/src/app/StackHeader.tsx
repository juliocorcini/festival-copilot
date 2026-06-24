import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
  /** Where back goes; defaults to browser back. */
  backTo?: string;
}

export function StackHeader({ title, backTo }: Props): JSX.Element {
  const navigate = useNavigate();
  const goBack = (): void => {
    if (backTo) navigate(backTo);
    else navigate(-1);
  };
  return (
    <header className="appbar" style={{ alignItems: "center", gap: 14 }}>
      <button className="ava" aria-label="Back" onClick={goBack} style={{ background: "var(--glass)", color: "var(--ink)", border: "1px solid var(--border)" }}>
        <span className="ms">arrow_back</span>
      </button>
      <h1 className="poster" style={{ fontSize: 22, flex: 1 }}>
        {title}
      </h1>
    </header>
  );
}
