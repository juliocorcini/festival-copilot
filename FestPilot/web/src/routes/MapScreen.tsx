import { MapView } from "../map/MapView";

/** Map tab. The map brings its own in-canvas chrome (topbar + sheet), so it renders
 * full-bleed in the content area above the bottom nav. Travel-time/POI land in Phase 3. */
export function MapScreen(): JSX.Element {
  return (
    <div className="screen-map">
      <MapView festivalId="tomorrowland-deschorre" />
    </div>
  );
}
