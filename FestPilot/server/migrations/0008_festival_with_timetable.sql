-- R4.1 (DEC-052): persist the source `config.withTimetable` flag per festival so the read API can
-- honestly surface the 3 data-states (nothing-yet / lineup-only / full-timetable). A festival can
-- have its full artist lineup announced while the clock-by-clock timetable is NOT yet released — the
-- source signals exactly that with withTimetable=false even though performance rows may carry times.
-- Default 1: existing live data (Tomorrowland) is already in timetable mode; the ingest keeps it fresh.

ALTER TABLE festival ADD COLUMN with_timetable INTEGER NOT NULL DEFAULT 1;
