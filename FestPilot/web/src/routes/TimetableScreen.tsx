/**
 * A3 Timetable (#15e, DEC-026/027/032): TML-style horizontal grid — rows = stages, columns = time.
 * Sticky time header + stage pills, dark-glass cards with gold favorites, per-card heart, a live NOW
 * line, "only my favs" filter and 1h/2h zoom. Layout math is pure (`domain/timetable.ts`); this screen
 * only renders it and wires favorites/day/zoom state. Lineup opens as a separate screen (one header icon).
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useFavorites, useOnboarding } from "../data/localStore";
import { useLineup } from "../data/useLineup";
import { buildTimetable } from "../domain/timetable";
import { festivalDataState } from "../domain/dataState";
import { imageByActKey } from "../domain/lineup";
import { countFavoritesPerDay, daysForWeekends, type DayInfo } from "../lib/festival";
import { stageColor, stageColorRgb, timeInZone } from "../lib/format";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { ViewSwitch } from "../ui/ViewSwitch";
import { DayDropdown } from "../ui/DayDropdown";
import { LineupUpdateBanner } from "../ui/LineupUpdateBanner";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { usePinch } from "../lib/usePinch";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";

type Zoom = "2h" | "1h";
const PIXELS_PER_HOUR: Record<Zoom, number> = { "2h": 180, "1h": 360 };
const HOUR_MS = 3_600_000;
// TT-5: left inset (px) for a card glued to the window start, so the first card unsticks from the
// border WITHOUT moving the time grid (its right edge stays anchored by shrinking the width).
const EDGE = 9;

export function TimetableScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const { onboarding } = useOnboarding();
  const favorites = useFavorites(lineup?.festival.id);
  const { openArtist } = useArtistSheet();

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>("1h");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Pinch to zoom: spread → 1-hour (zoomed in), pinch → 2-hour (zoomed out).
  const pinchRef = usePinch((dir) => setZoom(dir === "out" ? "1h" : "2h"));

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const tz = lineup?.festival.timezone ?? "UTC";
  const days = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds) : []), [lineup, weekendIds]);
  const dayKey = selectedDay ?? days[0]?.key ?? null;

  const model = useMemo(() => {
    if (!lineup) return null;
    return buildTimetable({
      performances: lineup.performances,
      stages: lineup.stages,
      favorites: favorites.keys,
      dayKey,
      weekendIds,
      timeZone: tz,
    });
  }, [lineup, favorites.keys, dayKey, weekendIds, tz]);

  const photoByKey = useMemo(() => imageByActKey(lineup?.performances ?? []), [lineup]);
  const favByDay = useMemo(
    () => countFavoritesPerDay(lineup?.performances ?? [], favorites.keys, days),
    [lineup, favorites.keys, days]
  );

  // Data-state (DEC-052): a lineup-only festival defaults straight to the Lineup (no dead timetable);
  // a not-yet-announced festival shows an honest empty state on both views.
  const dataState = lineup ? festivalDataState(lineup.hasLineup, lineup.hasTimetable) : null;
  useEffect(() => {
    if (dataState === "lineup_only") navigate("/lineup", { replace: true });
  }, [dataState, navigate]);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup || !model) {
    return (
      <div className="tt-screen">
        <TimetableHeader days={[]} dayKey={null} tz={tz} favByDay={favByDay} festivalName={lineup?.festival.name ?? ""} onSelectDay={setSelectedDay} />
        <ErrorState message={error ?? "Could not load the timetable."} onRetry={reload} />
      </div>
    );
  }

  if (dataState === "lineup_only") return <LoadingState />; // redirecting to /lineup
  if (dataState === "nothing") {
    return (
      <div className="tt-screen">
        <TimetableHeader days={[]} dayKey={null} tz={tz} favByDay={favByDay} festivalName={lineup?.festival.name ?? ""} onSelectDay={setSelectedDay} />
        <EmptyState
          icon="event_busy"
          title="No lineup announced yet"
          message="As soon as this festival reveals its artists, you'll pick favorites and build your plan right here."
        />
      </div>
    );
  }

  const contentWidth = Math.round(model.totalHours * PIXELS_PER_HOUR[zoom]);
  const nowPct = ((now - model.windowStartMs) / model.totalMs) * 100;
  const nowVisible = !model.isEmpty && nowPct >= 0 && nowPct <= 100;
  const label = (ms: number): string => timeInZone(new Date(ms).toISOString(), tz);

  const controls = (
    <div className="tt-ctrls">
      <button
        type="button"
        className="tt-ic"
        onClick={() => setZoom((z) => (z === "2h" ? "1h" : "2h"))}
        aria-label={zoom === "2h" ? "Zoom in to 1-hour view" : "Zoom out to 2-hour view"}
        title={zoom === "2h" ? "1-hour view" : "2-hour view"}
      >
        <span className="ms">{zoom === "2h" ? "zoom_in" : "zoom_out"}</span>
      </button>
      <button
        type="button"
        className={`tt-ic${onlyFavs ? " on" : ""}`}
        onClick={() => setOnlyFavs((v) => !v)}
        aria-pressed={onlyFavs}
        aria-label="Show only my favorites"
        title="Only my favs"
      >
        <span className="ms">favorite</span>
      </button>
      <button
        type="button"
        className="tt-lk"
        onClick={() => navigate(`/lockin${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
      >
        <span className="ms">playlist_add_check</span>
        Lock in
      </button>
    </div>
  );

  return (
    <div className="tt-screen">
      <TimetableHeader
        days={days}
        dayKey={dayKey}
        tz={tz}
        favByDay={favByDay}
        festivalName={lineup.festival.name}
        onSelectDay={setSelectedDay}
        controls={controls}
      />

      <LineupUpdateBanner />

      {model.isEmpty ? (
        <EmptyState
          icon="calendar_month"
          title="No sets yet"
          message="No performances are scheduled for this day in the published lineup."
        />
      ) : (
        <div className="tt-scroll" ref={pinchRef}>
          <div className={`tt-content${onlyFavs ? " filtered" : ""}`} style={{ width: contentWidth }}>
            <div className="time-row">
              {model.hourMarks.map((mark) => {
                const isNow = nowVisible && now >= mark.ms && now < mark.ms + HOUR_MS;
                return (
                  <span key={mark.ms} className={`t${isNow ? " now" : ""}`} style={{ left: `${mark.leftPct}%` }}>
                    {label(mark.ms)}
                  </span>
                );
              })}
            </div>

            <div className="tt-grid" aria-hidden="true">
              {model.gridLines.map((line) => (
                <span key={line.ms} className={`gl${line.half ? " half" : ""}`} style={{ left: `${line.leftPct}%` }} />
              ))}
            </div>

            {nowVisible && <div className="now-line" style={{ left: `${nowPct}%` }} />}

            {model.stages.map((stage) => {
              const color = stageColor(stage.name);
              const favCount = stage.sets.filter((s) => s.isFav).length;
              return (
                <div key={stage.id} className={`stage${stage.hasFav ? " has-fav" : ""}`}>
                  <div className="stage-name">
                    <span className="pin" style={{ background: color }} />
                    <span className="nm" style={{ color }}>
                      {stage.name}
                    </span>
                    {favCount > 0 && <span className="ct">★ {favCount}</span>}
                  </div>
                  <div className="track">
                    {stage.sets.map((set) => {
                      const isLive = now >= set.startMs && now < set.endMs;
                      // TT-5: only the card glued to the window start (leftPct 0) gets the EDGE inset.
                      const atWindowStart = set.startMs === model.windowStartMs;
                      const cardStyle = {
                        left: atWindowStart ? `${EDGE}px` : `${set.leftPct}%`,
                        // R7.3: a hairline inset so back-to-back sets (endMs == nextStartMs) never glue.
                        width: atWindowStart
                          ? `calc(${set.widthPct}% - ${EDGE}px - 3px)`
                          : `calc(${set.widthPct}% - 3px)`,
                        "--c": stageColorRgb(stage.name),
                      } as CSSProperties;
                      return (
                        <div
                          key={set.id}
                          className={`set${set.isFav ? " fav" : ""}${isLive ? " live" : ""}`}
                          style={cardStyle}
                        >
                          <div
                            className="set-inner tappable"
                            role="button"
                            tabIndex={0}
                            aria-label={`View ${set.label}`}
                            onClick={() => openArtist(set.actKey)}
                            onKeyDown={openOnActivate(() => openArtist(set.actKey))}
                          >
                            <ArtistPhoto
                              src={photoByKey.get(set.actKey) ?? null}
                              name={set.label}
                              width={PHOTO_WIDTH.list}
                              className="photo"
                            />
                            <div className="info">
                              <div className="name">{set.label}</div>
                              <div className="meta">
                                {label(set.startMs)} – {label(set.endMs)}
                              </div>
                            </div>
                          </div>
                          <button
                            className="heart"
                            data-haptic="select"
                            aria-label={set.isFav ? "Remove favorite" : "Add favorite"}
                            onClick={() => favorites.toggle(set.actKey)}
                          >
                            <span className="ms">{set.isFav ? "favorite" : "favorite_border"}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="view-switch-dock">
        <ViewSwitch active="timetable" />
      </div>
    </div>
  );
}

function TimetableHeader({
  days,
  dayKey,
  tz,
  favByDay,
  festivalName,
  onSelectDay,
  controls,
}: {
  days: DayInfo[];
  dayKey: string | null;
  tz: string;
  favByDay: Map<string, number>;
  festivalName: string;
  onSelectDay: (key: string) => void;
  controls?: JSX.Element;
}): JSX.Element {
  const hasBar = days.length > 0 || Boolean(controls);
  return (
    <header className="tt-top">
      <div className="shell-eyebrow">
        {festivalName} <span className="view">TIMETABLE</span>
      </div>
      {hasBar && (
        <div className="tt-bar">
          {days.length > 0 && (
            <DayDropdown days={days} dayKey={dayKey} tz={tz} favByDay={favByDay} onSelect={onSelectDay} />
          )}
          {controls}
        </div>
      )}
    </header>
  );
}
