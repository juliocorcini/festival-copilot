/**
 * Lineup (#22) — browse people, separate from the Timetable (DEC-026/028). Search, filter by
 * favorites/day, and heart acts. Favorites persist locally (DEC-041) and an act appears once
 * even if it plays multiple days.
 */
import { useMemo, useState, type CSSProperties } from "react";
import { useFavorites, useOnboarding } from "../data/localStore";
import { useLineup } from "../data/useLineup";
import { festivalDataState } from "../domain/dataState";
import { festivalDayIdByPerformanceId } from "../domain/festivalDay";
import { performancesForWeekends, uniqueActs, type Act } from "../domain/lineup";
import { countFavoritesPerDay, daysForWeekends, type DayInfo } from "../lib/festival";
import { stageColorRgb } from "../lib/format";
import { useT, useLocale } from "../i18n";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { PullToRefresh } from "../ui/PullToRefresh";
import { ViewSwitch } from "../ui/ViewSwitch";
import { DayDropdown } from "../ui/DayDropdown";
import { LineupUpdateBanner } from "../ui/LineupUpdateBanner";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { toast } from "../lib/toast";
import { usePinch } from "../lib/usePinch";
import { useArtistSheet } from "../ui/useArtistSheet";

// LU-2: grid density (2/3/4 columns) persists locally (DEC-041), self-contained to this screen.
type Cols = 2 | 3 | 4;
const COLS_KEY = "fp.lineup.cols";
function loadCols(): Cols {
  try {
    const v = Number(localStorage.getItem(COLS_KEY));
    if (v === 2 || v === 3 || v === 4) return v;
  } catch {
    /* storage unavailable */
  }
  return 2;
}

// D16: the "Your Favorites" section collapses; the choice is remembered for the session (not forever —
// a fresh visit re-opens it so favorites stay discoverable). Defaults open.
const FAV_OPEN_KEY = "fp.lineup.favOpen";
function loadFavOpen(): boolean {
  try {
    return sessionStorage.getItem(FAV_OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

const DENSITY_OPTIONS: { c: Cols; icon: string }[] = [
  { c: 2, icon: "grid_view" },
  { c: 3, icon: "view_module" },
  { c: 4, icon: "view_comfy" },
];

function DensityControl({ cols, onChange }: { cols: Cols; onChange: (c: Cols) => void }): JSX.Element {
  const t = useT();
  return (
    <div className="density" role="group" aria-label={t("lineup.gridDensity")}>
      {DENSITY_OPTIONS.map((o) => {
        const label = t("lineup.cols", { n: o.c });
        return (
          <button
            key={o.c}
            type="button"
            className={o.c === cols ? "on" : ""}
            aria-pressed={o.c === cols}
            aria-label={label}
            title={label}
            onClick={() => onChange(o.c)}
          >
            <span className="ms">{o.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LineupScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const { onboarding } = useOnboarding();
  const t = useT();
  const locale = useLocale();
  const festivalId = lineup?.festival.id;
  const favorites = useFavorites(festivalId);
  const { openArtist } = useArtistSheet();

  const [query, setQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string | "all">("all");
  const [favOnly, setFavOnly] = useState(false);
  const [cols, setColsState] = useState<Cols>(loadCols);
  const setCols = (c: Cols): void => {
    setColsState(c);
    try {
      localStorage.setItem(COLS_KEY, String(c));
    } catch {
      /* storage unavailable */
    }
  };
  // Pinch to set density: spread → fewer/bigger columns, pinch → more/smaller columns.
  const clampCols = (c: number): Cols => (c < 2 ? 2 : c > 4 ? 4 : (c as Cols));
  const pinchRef = usePinch((dir) => setCols(clampCols(dir === "out" ? cols - 1 : cols + 1)));

  const [favOpen, setFavOpenState] = useState<boolean>(loadFavOpen);
  const setFavOpen = (open: boolean): void => {
    setFavOpenState(open);
    try {
      sessionStorage.setItem(FAV_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };

  // Scope everything (days, acts, favorites, day tags) to the weekend(s) chosen at onboarding —
  // otherwise a W2 attendee sees W1-only acts and wrong day chips (the source `day` label is shared
  // across weekends). Empty selection = all weekends.
  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const scopedPerformances = useMemo(
    () => (lineup ? performancesForWeekends(lineup.performances, weekendIds) : []),
    [lineup, weekendIds]
  );

  const days = useMemo<DayInfo[]>(() => (lineup ? daysForWeekends(lineup, weekendIds, locale) : []), [lineup, weekendIds, locale]);
  const tz = lineup?.festival.timezone ?? "UTC";
  const favByDay = useMemo(
    () => countFavoritesPerDay(scopedPerformances, favorites.keys, days),
    [scopedPerformances, favorites.keys, days]
  );
  const stageName = useMemo(() => {
    const map = new Map<string, string>();
    lineup?.stages.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [lineup]);

  // Tag each act with the same festival-day id the timetable/day-chips use (DEC-048), so the day
  // filter matches and a post-midnight set is attributed to the night it belongs to.
  const acts = useMemo(() => {
    if (!lineup) return [];
    const dayById = festivalDayIdByPerformanceId(scopedPerformances);
    return uniqueActs(scopedPerformances, { dayOf: (p) => dayById.get(p.id) ?? p.day });
  }, [lineup, scopedPerformances]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return acts.filter((act) => {
      if (favOnly && !favorites.isFavorite(act.actKey)) return false;
      if (dayFilter !== "all" && !act.days.includes(dayFilter)) return false;
      if (q && !act.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [acts, query, dayFilter, favOnly, favorites]);

  if (status === "loading") return <LoadingState variant="grid" />;
  if (status === "error" || !lineup) return <ErrorState message={error ?? t("lineup.loadError")} onRetry={reload} />;

  const dataState = festivalDataState(lineup.hasLineup, lineup.hasTimetable);
  if (dataState === "nothing") {
    return (
      <div className="screen" style={{ paddingTop: "calc(10px + var(--safe-top))" }}>
        <EmptyState
          icon="event_busy"
          title={t("lineup.noLineupTitle")}
          message={t("lineup.noLineupMsg")}
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

  const renderCard = (act: Act, index: number): JSX.Element => {
    const on = favorites.isFavorite(act.actKey);
    const stage = stageName.get(act.stageIds[0] ?? "") ?? "";
    // Only the first rows cascade (the rest mount instantly) so a 600-act grid never ripples.
    const rises = index < 10;
    const cardStyle = { "--c": stageColorRgb(stage), ...(rises ? { "--i": index } : {}) } as CSSProperties;
    return (
      <div className={`gc${on ? " on" : ""}${rises ? " fp-rise" : ""}`} key={act.actKey} style={cardStyle}>
        <button
          type="button"
          className="gc-tap"
          aria-label={t("common.viewAct", { name: act.label })}
          onClick={() => openArtist(act.actKey)}
        >
          <ArtistPhoto src={act.imageUrl} name={act.label} width={PHOTO_WIDTH.grid} className="gc-photo" />
          <span className="gc-gloss" aria-hidden="true" />
          <span className="gc-scrim">
            <span className="gc-name">{act.label}</span>
            <span className="gc-chip"><span className="dot" aria-hidden="true" />{meta(act)}</span>
          </span>
        </button>
        <button
          className="gc-heart"
          data-haptic="select"
          aria-pressed={on}
          aria-label={on ? t("lineup.removeFav", { name: act.label }) : t("lineup.addFav", { name: act.label })}
          onClick={() => {
            favorites.toggle(act.actKey);
            toast.show({
              message: on ? t("common.removedToast", { name: act.label }) : t("common.savedToast", { name: act.label }),
              tone: on ? "info" : "success",
              key: "favorite",
              haptic: false,
            });
          }}
        >
          <span className="ms">{on ? "favorite" : "favorite_border"}</span>
        </button>
      </div>
    );
  };

  return (
    <div
      ref={pinchRef}
      className={`screen cols-${cols}${dataState === "timetable" ? " has-view-dock" : ""}`}
      style={{ paddingTop: "calc(8px + var(--safe-top))", paddingInline: 16 }}
    >
      <PullToRefresh onRefresh={reload} />
      <header className="lu-top">
        <div className="shell-eyebrow">
          {lineup.festival.name} <span className="view">{t("lineup.view")}</span>
        </div>
      </header>
      {dataState === "lineup_only" && (
        <div className="lineup-note">
          <span className="ms" aria-hidden="true">schedule</span>
          <span>{t("lineup.lineupOnlyNote")}</span>
        </div>
      )}

      <LineupUpdateBanner />

      <div className="glass lineup-search">
        <span className="ms">search</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.searchArtists")}
          aria-label={t("common.searchArtistsAria")}
        />
        {query && (
          <button className="ob-skip" style={{ padding: 0 }} onClick={() => setQuery("")} aria-label={t("lineup.clearSearch")}>
            <span className="ms">close</span>
          </button>
        )}
      </div>

      <div className="filter-rail">
        <button className={`chip${favOnly ? " on" : ""}`} onClick={() => setFavOnly((v) => !v)}>
          <span className="ms" style={{ fontSize: 14 }}>star</span> {t("lineup.favorites")}
        </button>
        <button className={`chip${dayFilter === "all" ? " on" : ""}`} onClick={() => setDayFilter("all")}>{t("lineup.allDays")}</button>
        <DayDropdown
          days={days}
          dayKey={dayFilter === "all" ? null : dayFilter}
          tz={tz}
          favByDay={favByDay}
          onSelect={(key) => setDayFilter(key)}
        />
      </div>

      {filtered.length === 0 && (
        <div className="state"><span className="ms">search_off</span><h2>{t("lineup.noneTitle")}</h2><p>{t("lineup.noneMsg")}</p></div>
      )}

      {favoriteActs.length > 0 && (
        <>
          <div className="sec">
            <button
              type="button"
              className="sec-toggle"
              aria-expanded={favOpen}
              onClick={() => setFavOpen(!favOpen)}
            >
              <span className={`ms sec-caret${favOpen ? "" : " closed"}`} aria-hidden="true">expand_more</span>
              {t("lineup.yourFavorites", { count: favoriteActs.length })}
            </button>
            <DensityControl cols={cols} onChange={setCols} />
          </div>
          {favOpen && <div className="grid">{favoriteActs.map(renderCard)}</div>}
        </>
      )}
      {otherActs.length > 0 && (
        <>
          <div className="sec">
            <span>{t("lineup.allArtists", { count: otherActs.length })}</span>
            {favoriteActs.length === 0 && <DensityControl cols={cols} onChange={setCols} />}
          </div>
          <div className="grid">{otherActs.map(renderCard)}</div>
        </>
      )}

      {dataState === "timetable" && (
        <div className="view-switch-dock">
          <ViewSwitch active="lineup" />
        </div>
      )}
    </div>
  );
}
