/**
 * "Why this pick?" sheet (E08 · DEC-096). Explains, in plain language and WITH names, why a block's
 * winner was chosen — who locked it, who favorited the act, the rule that applied, and where the rest
 * split — plus a short glossary of the methods. It only READS the aggregated block via the pure
 * `explainSquadBlock`; it never changes the math (winners stay identical to the baseline).
 */
import { Sheet } from "../../ui/Sheet";
import { useT, type TranslateFn } from "../../i18n";
import { explainSquadBlock } from "../../domain/squadExplain";
import type { SquadBlock, SquadMember } from "../../domain/squadPlan";

/** Join member names for display, falling back to "Guest" for nameless members and a quiet empty line. */
function nameList(names: (string | null)[], t: TranslateFn): string {
  const clean = names.map((n) => n ?? t("common.guest"));
  return clean.length > 0 ? clean.join(", ") : t("why.noneYet");
}

export function WhyThisSheet({
  block,
  members,
  onClose,
}: {
  block: SquadBlock;
  members: SquadMember[];
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  const ex = explainSquadBlock(block, members);

  let headline: string;
  if (ex.pinned) headline = t("why.ownerPin", { label: ex.winnerLabel });
  else if (ex.method === "owner") headline = t("why.owner", { stage: ex.stageName });
  else if (ex.method === "favorited") headline = t("why.favorited", { stage: ex.stageName, fav: ex.favCount });
  else headline = t("why.plurality", { stage: ex.stageName, going: ex.goingCount, total: ex.memberCount });

  return (
    <Sheet onClose={onClose} label={t("why.title")} className="why-sheet">
      <div className="sheet-head">
        <h2 className="sheet-title">{t("why.title")}</h2>
        <button className="ms sheet-x" aria-label={t("common.close")} onClick={onClose}>
          close
        </button>
      </div>

      <div className="sheet-body why-body">
        <p className="why-headline">{headline}</p>

        <div className="why-section">
          <span className="label">{t("why.going", { count: ex.goingCount })}</span>
          <p className="why-names">{nameList(ex.goingNames, t)}</p>
        </div>

        {ex.favCount > 0 && (
          <div className="why-section">
            <span className="label">{t("why.favBy", { count: ex.favCount })}</span>
            <p className="why-names">{nameList(ex.favoritedNames, t)}</p>
          </div>
        )}

        {ex.splits.length > 0 && (
          <div className="why-section">
            <span className="label">{t("block.split")}</span>
            {ex.splits.map((s, i) => (
              <p className="why-names" key={`${s.label}-${i}`}>
                <b>{s.label}</b> · {s.stageName} — {nameList(s.names, t)}
              </p>
            ))}
          </div>
        )}

        <div className="why-glossary">
          <span className="label">{t("why.glossaryTitle")}</span>
          <ul>
            <li>{t("why.glPlurality")}</li>
            <li>{t("why.glFav")}</li>
            <li>{t("why.glOwner")}</li>
          </ul>
          <p className="why-note">{t("why.glNote")}</p>
        </div>
      </div>
    </Sheet>
  );
}
