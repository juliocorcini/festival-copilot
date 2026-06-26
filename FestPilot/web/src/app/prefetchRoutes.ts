/**
 * Warm the lazy primary-tab chunks (Map, Squad) once the app is idle, so the FIRST tap on those
 * tabs is instant instead of briefly showing the route fallback (the one cost of the route-level
 * code-split in v0.31.0). These use the exact same import specifiers as App.tsx's `lazy()`, so Vite
 * serves the same chunk — this only warms the module cache, it never loads anything twice.
 *
 * Festival-aware: we respect Save-Data and skip on 2g, because prefetching for someone who never
 * opens Map/Squad would waste their (often scarce) data. It runs once, after first paint, on idle.
 */
let warmed = false;

interface SaveDataConnection {
  saveData?: boolean;
  effectiveType?: string;
}

function shouldSkipForData(): boolean {
  const conn = (navigator as unknown as { connection?: SaveDataConnection }).connection;
  if (!conn) return false;
  return conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType ?? "");
}

export function prefetchPrimaryTabs(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  if (shouldSkipForData()) return;

  const warm = (): void => {
    void import("../routes/MapScreen");
    void import("../routes/SquadScreen");
  };

  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
    .requestIdleCallback;
  if (typeof ric === "function") ric(warm, { timeout: 3000 });
  else window.setTimeout(warm, 1500);
}
