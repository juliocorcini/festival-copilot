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
import { daysForWeekends, type DayInfo } from "../lib/festival";
import { stageColor, stageColorRgb, timeInZone } from "../lib/format";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { ViewSwitch } from "../ui/ViewSwitch";
import { LineupUpdateBanner } from "../ui/LineupUpdateBanner";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";

type Zoom = "2h" | "1h";
const PIXELS_PER_HOUR: Record<Zoom, number> = { "2h": 180, "1h": 360 };
const HOUR_MS = 3_600_000;

export function TimetableScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const { onboarding } = useOnboarding();
  const favorites = useFavorites(lineup?.festival.id);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>("2h");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [now, setNow] = useState(() => Date.now());

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
        <TimetableHeader days={[]} dayKey={null} tz={tz} onSelectDay={setSelectedDay} />
        <ErrorState message={error ?? "Could not load the timetable."} onRetry={reload} />
      </div>
    );
  }

  if (dataState === "lineup_only") return <LoadingState />; // redirecting to /lineup
  if (dataState === "nothing") {
    return (
      <div className="tt-screen">
        <TimetableHeader days={[]} dayKey={null} tz={tz} onSelectDay={setSelectedDay} />
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

  return (
    <div className="tt-screen">
      <TimetableHeader days={days} dayKey={dayKey} tz={tz} onSelectDay={setSelectedDay} />

      <LineupUpdateBanner />

      <div className="tt-controls">
        <div className="tt-controls-left">
          <button className="pill tt-toggle" onClick={() => setZoom((z) => (z === "2h" ? "1h" : "2h"))}>
            <span className="ms" style={{ fontSize: 15 }}>zoom_in</span>
            {zoom} view
          </button>
          <button className={`pill tt-toggle${onlyFavs ? " on" : ""}`} onClick={() => setOnlyFavs((v) => !v)}>
            <span className="ms" style={{ fontSize: 15 }}>favorite</span>
            Only my favs
          </button>
          <button
            className={`pill tt-toggle${showGrid ? " on" : ""}`}
            onClick={() => setShowGrid((v) => !v)}
            aria-pressed={showGrid}
            aria-label="Toggle time gridlines"
          >
            <span className="ms" style={{ fontSize: 15 }}>grid_on</span>
            Grid
          </button>
        </div>
        <button
          className="pill tt-lockin"
          onClick={() => navigate(`/lockin${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
        >
          <span className="ms" style={{ fontSize: 15 }}>lock</span>
          Lock in
        </button>
      </div>

      {model.isEmpty ? (
        <EmptyState
          icon="calendar_month"
          title="No sets yet"
          message="No performances are scheduled for this day in the published lineup."
        />
      ) : (
        <div className="tt-scroll">
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

            {showGrid && (
              <div className="tt-grid" aria-hidden="true">
                {model.gridLines.map((line) => (
                  <span key={line.ms} className={`gl${line.half ? " half" : ""}`} style={{ left: `${line.leftPct}%` }} />
                ))}
              </div>
            )}

            {nowVisible && <div className="now-line" style={{ left: `${nowPct}%` }} />}

            {model.stages.map((stage) => {
              const color = stageColor(stage.name);
              return (
                <div key={stage.id} className={`stage${stage.hasFav ? " has-fav" : ""}`}>
                  <div className="stage-name">
                    <span className="pin" style={{ background: color }} />
                    <span className="nm" style={{ color }}>
                      {stage.name}
                    </span>
                  </div>
                  <div className="track">
                    {stage.sets.map((set) => {
                      const cardStyle = {
                        left: `${set.leftPct}%`,
                        // R7.3: a hairline inset so back-to-back sets (endMs == nextStartMs) never glue.
                        width: `calc(${set.widthPct}% - 3px)`,
                        "--c": stageColorRgb(stage.name),
                      } as CSSProperties;
                      return (
                        <div key={set.id} className={`set${set.isFav ? " fav" : ""}`} style={cardStyle}>
                          <div className="set-inner">
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
    </div>
  );
}

function TimetableHeader({
  days,
  dayKey,
  tz,
  onSelectDay,
}: {
  days: DayInfo[];
  dayKey: string | null;
  tz: string;
  onSelectDay: (key: string) => void;
}): JSX.Element {
  return (
    <header className="tt-top">
      <div className="tt-top-row">
        <h1 className="poster">Timetable</h1>
        <ViewSwitch active="timetable" />
      </div>
      {days.length > 0 && (
        <div className="tt-days">
          {days.map((day) => (
            <button
              key={day.key}
              className={`pill tt-day${day.key === dayKey ? " on" : ""}`}
              onClick={() => onSelectDay(day.key)}
            >
              {day.weekdayShort} {dayOfMonth(day.startMs, tz)}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function dayOfMonth(startMs: number, timeZone: string): string {
  if (!Number.isFinite(startMs)) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone }).format(startMs);
}
