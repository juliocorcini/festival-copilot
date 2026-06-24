/**
 * Lineup (#22) — browse people, separate from the Timetable (DEC-026/028). Search, filter by
 * favorites/day, and heart acts. Favorites persist locally (DEC-041) and an act appears once
 * even if it plays multiple days.
 */
import { useMemo, useState } from "react";
import { useFavorites } from "../data/localStore";
import { useLineup } from "../data/useLineup";
import { festivalDataState } from "../domain/dataState";
import { uniqueActs, type Act } from "../domain/lineup";
import { daysForWeekends, initials, type DayInfo } from "../lib/festival";
import { stageColor } from "../lib/format";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { ViewSwitch } from "../ui/ViewSwitch";

export function LineupScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const festivalId = lineup?.festival.id;
  const favorites = useFavorites(festivalId);

  const [query, setQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string | "all">("all");
  const [favOnly, setFavOnly] = useState(false);

  const days = useMemo<DayInfo[]>(() => (lineup ? daysForWeekends(lineup, []) : []), [lineup]);
  const stageName = useMemo(() => {
    const map = new Map<string, string>();
    lineup?.stages.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [lineup]);

  const acts = useMemo(() => (lineup ? uniqueActs(lineup.performances) : []), [lineup]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return acts.filter((act) => {
      if (favOnly && !favorites.isFavorite(act.actKey)) return false;
      if (dayFilter !== "all" && !act.days.includes(dayFilter)) return false;
      if (q && !act.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [acts, query, dayFilter, favOnly, favorites]);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) return <ErrorState message={error ?? "Could not load."} onRetry={reload} />;

  const dataState = festivalDataState(lineup.hasLineup, lineup.hasTimetable);
  if (dataState === "nothing") {
    return (
      <div className="screen" style={{ paddingTop: "calc(10px + var(--safe-top))" }}>
        <EmptyState
          icon="event_busy"
          title="No lineup announced yet"
          message="This festival hasn't revealed its artists. Check back soon — you'll pick favorites here the moment it does."
        />
      </div>
    );
  }

  const favoriteActs = filtered.filter((a) => favorites.isFavorite(a.actKey));
  const otherActs = favOnly ? [] : filtered.filter((a) => !favorites.isFavorite(a.actKey));

  const meta = (act: Act): string => {
    const stage = stageName.get(act.stageIds[0] ?? "") ?? "";
    const dayLabels = act.days.map((k) => days.find((d) => d.key === k)?.weekdayShort ?? k).join(" + ");
    return [stage, dayLabels].filter(Boolean).join(" · ");
  };

  const renderRow = (act: Act): JSX.Element => {
    const on = favorites.isFavorite(act.actKey);
    const color = stageColor(stageName.get(act.stageIds[0] ?? ""));
    return (
      <div className="art-row" key={act.actKey}>
        <div className="avatar-sq" style={{ color }}>{initials(act.label)}</div>
        <div className="art-info">
          <div className="nm">{act.label}</div>
          <div className="mt">{meta(act)}</div>
        </div>
        <button
          className={`heart-btn${on ? " on" : ""}`}
          aria-pressed={on}
          aria-label={on ? `Remove ${act.label} from favorites` : `Add ${act.label} to favorites`}
          onClick={() => favorites.toggle(act.actKey)}
        >
          <span className="ms">{on ? "favorite" : "favorite_border"}</span>
        </button>
      </div>
    );
  };

  return (
    <div className="screen" style={{ paddingTop: "calc(10px + var(--safe-top))" }}>
      {dataState === "timetable" && (
        <div className="lineup-switch-row">
          <ViewSwitch active="lineup" />
        </div>
      )}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--muted)", fontWeight: 700 }}>
            {lineup.festival.name.toUpperCase()}
          </div>
          <h1 className="poster" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 0" }}>Lineup</h1>
        </div>
        <div className="fav-count">
          <div className="n">{favorites.count}</div>
          <div className="l">favorites</div>
        </div>
      </header>
      {dataState === "lineup_only" && (
        <div className="lineup-note">
          <span className="ms" aria-hidden="true">schedule</span>
          <span>The full timetable isn't out yet — favorite who you want to see and we'll build your plan the moment it drops.</span>
        </div>
      )}

      <div className="glass lineup-search">
        <span className="ms">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists…"
          aria-label="Search artists"
        />
        {query && (
          <button className="ob-skip" style={{ padding: 0 }} onClick={() => setQuery("")} aria-label="Clear search">
            <span className="ms">close</span>
          </button>
        )}
      </div>

      <div className="filter-rail">
        <button className={`chip${favOnly ? " on" : ""}`} onClick={() => setFavOnly((v) => !v)}>
          <span className="ms" style={{ fontSize: 14 }}>star</span> Favorites
        </button>
        <button className={`chip${dayFilter === "all" ? " on" : ""}`} onClick={() => setDayFilter("all")}>All days</button>
        {days.map((d) => (
          <button
            key={d.key}
            className={`chip${dayFilter === d.key ? " on" : ""}`}
            onClick={() => setDayFilter(d.key)}
          >
            {d.weekdayShort}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="state"><span className="ms">search_off</span><h2>No artists found</h2><p>Try a different search or filter.</p></div>
      )}

      {favoriteActs.length > 0 && (
        <>
          <div className="sec">YOUR FAVORITES · {favoriteActs.length}</div>
          {favoriteActs.map(renderRow)}
        </>
      )}
      {otherActs.length > 0 && (
        <>
          <div className="sec">ALL ARTISTS · {otherActs.length}</div>
          {otherActs.map(renderRow)}
        </>
      )}
    </div>
  );
}
