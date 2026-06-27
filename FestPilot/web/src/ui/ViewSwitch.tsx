/**
 * Compact Timetable⇄Lineup segmented switch (DEC-049). Keeps the Timetable full-height (it's not a
 * 6th tab — DEC-032) while making the Lineup reachable in a single tap from the Timetable and back.
 * Only rendered when a timetable exists (see domain/dataState.showsViewSwitch); lineup-only festivals
 * default straight to the Lineup, so there's nothing to switch to.
 */
import { useNavigate } from "react-router-dom";
import { useT } from "../i18n";

export function ViewSwitch({ active }: { active: "timetable" | "lineup" }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  return (
    <div className="view-switch" role="tablist" aria-label={t("view.switch")}>
      <button
        type="button"
        role="tab"
        aria-selected={active === "timetable"}
        className={`vs-seg${active === "timetable" ? " on" : ""}`}
        onClick={() => active !== "timetable" && navigate("/timetable")}
      >
        <span className="ms" aria-hidden="true">calendar_month</span>
        {t("view.timetable")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "lineup"}
        className={`vs-seg${active === "lineup" ? " on" : ""}`}
        onClick={() => active !== "lineup" && navigate("/lineup")}
      >
        <span className="ms" aria-hidden="true">groups</span>
        {t("view.lineup")}
      </button>
    </div>
  );
}
