/**
 * Light Artist Detail Sheet scope (ART-6, DEC-069). A provider mounted once over the primary tabs
 * exposes `openArtist(actKey)`; any surface (timetable, lineup, now, my plan) calls it to open the
 * sheet without each screen re-deriving the lineup. The sheet's data is built lazily from the same
 * `lineup` via the pure `buildArtistDetail` helper — no new lineup math here.
 *
 * Opening a placeholder/unknown act is a graceful no-op (the act map only holds real artists).
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { LineupDto } from "../data/types";
import { performancesForWeekends, uniqueActs, type Act } from "../domain/lineup";
import { buildArtistDetail, type ArtistDetail } from "../domain/artistDetail";
import { useOnboarding } from "../data/localStore";
import { ArtistSheet } from "./ArtistSheet";

interface ArtistSheetApi {
  openArtist: (actKey: string) => void;
}

const ArtistSheetContext = createContext<ArtistSheetApi>({ openArtist: () => {} });

/** Open the Artist Detail Sheet for an act key. No-op when no provider is mounted. */
export function useArtistSheet(): ArtistSheetApi {
  return useContext(ArtistSheetContext);
}

/**
 * Keyboard activation for non-button elements acting as buttons (`role="button"`): Enter/Space fire
 * the same action a click would, so photo/name tap targets stay reachable by keyboard.
 */
export function openOnActivate(open: () => void) {
  return (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
}

export function ArtistSheetProvider({
  lineup,
  children,
}: {
  lineup: LineupDto | null;
  children: ReactNode;
}): JSX.Element {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const { onboarding } = useOnboarding();

  // The sheet's "where & when" must mirror the chosen weekend(s): only show the slots that belong to
  // the festival the user is actually attending (DEC-048), so a W2 attendee never sees a W1 set time.
  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const actByKey = useMemo(() => {
    const map = new Map<string, Act>();
    if (lineup) {
      const scoped = performancesForWeekends(lineup.performances, weekendIds);
      for (const act of uniqueActs(scoped)) map.set(act.actKey, act);
    }
    return map;
  }, [lineup, weekendIds]);

  const detail = useMemo<ArtistDetail | null>(() => {
    if (!openKey || !lineup) return null;
    const act = actByKey.get(openKey);
    if (!act) return null;
    return buildArtistDetail(act, lineup.stages, lineup.weekends, lineup.festival.timezone);
  }, [openKey, lineup, actByKey]);

  const openArtist = useCallback((actKey: string) => {
    if (actKey) setOpenKey(actKey);
  }, []);

  // History-friendly close: the device Back button dismisses the sheet instead of leaving the tab.
  useEffect(() => {
    if (!openKey || typeof window === "undefined") return;
    if (!window.history.state?.fpArtistSheet) {
      window.history.pushState({ ...window.history.state, fpArtistSheet: true }, "");
    }
    const onPop = (): void => setOpenKey(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openKey]);

  const close = useCallback((): void => {
    if (typeof window !== "undefined" && window.history.state?.fpArtistSheet) {
      window.history.back(); // unwinds the pushed entry → popstate closes the sheet
    } else {
      setOpenKey(null);
    }
  }, []);

  const api = useMemo<ArtistSheetApi>(() => ({ openArtist }), [openArtist]);

  return createElement(
    ArtistSheetContext.Provider,
    { value: api },
    children,
    detail ? createElement(ArtistSheet, { detail, onClose: close }) : null
  );
}
