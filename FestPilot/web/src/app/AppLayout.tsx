import { useMemo } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { useLineup } from "../data/useLineup";
import { useFavorites } from "../data/localStore";
import { imageByActKey } from "../domain/lineup";
import { useKeepFavoritePhotos } from "../lib/usePhotoPrefetch";
import { ArtistSheetProvider } from "../ui/useArtistSheet";

/** Shell for the 5 primary tabs: scrollable content + persistent bottom nav. */
export function AppLayout(): JSX.Element {
  // Pin favorites' photos offline (IMG-5): mounted here so it spans every primary tab. Reuses the
  // domain `imageByActKey` map (actKey → photo) — no new lineup math.
  const { lineup } = useLineup();
  const favorites = useFavorites(lineup?.festival.id);
  const imageByKey = useMemo(
    () => (lineup ? imageByActKey(lineup.performances) : new Map<string, string | null>()),
    [lineup]
  );
  useKeepFavoritePhotos(imageByKey, favorites.keys);

  // Re-key the scroll container by route so each tab fades in (route-fade) and starts at the top,
  // instead of a hard cut. Keying `<main>` (not a wrapper) keeps the height chain intact for
  // full-height screens (timetable/map). The fade is opacity-only (see styles.css) so it never
  // creates a containing block that would break the fixed view-switch dock / Artist Sheet.
  const { pathname } = useLocation();

  // ArtistSheetProvider spans every primary tab so any surface can open the Artist Detail Sheet
  // (ART-6). The sheet renders as a direct child of `.app`, overlaying the bottom nav (z-index 50).
  return (
    <div className="app">
      <ArtistSheetProvider lineup={lineup}>
        <main className="scr route-fade" key={pathname}>
          <Outlet />
        </main>
        <BottomNav />
      </ArtistSheetProvider>
    </div>
  );
}
