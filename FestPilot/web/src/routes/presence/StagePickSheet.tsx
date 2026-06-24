/** Bottom sheet to answer a ping by declaring a stage (push-reply; works with GPS off — #25.4). */
import type { StageDto } from "../../data/types";

export function StagePickSheet({
  title,
  stages,
  busy,
  onPick,
  onClose,
}: {
  title: string;
  stages: StageDto[] | null;
  busy: boolean;
  onPick: (stageId: string) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="sheet stage-sheet glass" onClick={(e) => e.stopPropagation()}>
        <div className="precise-grip" />
        <div className="stage-sheet-head">
          <div className="stage-sheet-title">{title}</div>
          <button className="ava stage-sheet-close" aria-label="Close" onClick={onClose}>
            <span className="ms">close</span>
          </button>
        </div>
        <div className="stage-sheet-list">
          {stages === null ? (
            <div className="shimmer" style={{ height: 48 }} />
          ) : (
            stages.map((s) => (
              <button key={s.id} className="glass stage-sheet-row" disabled={busy} onClick={() => onPick(s.id)}>
                <span className="ms" style={{ color: "var(--accent)" }} aria-hidden="true">apartment</span>
                <span className="stage-sheet-name">{s.name}</span>
                <span className="ms" style={{ color: "var(--muted)" }} aria-hidden="true">chevron_right</span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
