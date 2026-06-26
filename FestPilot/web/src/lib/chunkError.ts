/**
 * Detects a failed dynamic `import()` — a code-split chunk that couldn't be fetched or parsed —
 * across the browser/bundler phrasings seen in the wild. Pure (no DOM) so the branch can be unit
 * tested with the real strings and the ErrorBoundary stays trivial.
 *
 * Why it matters: route clusters are lazy (see App.tsx). On flaky on-site connectivity a chunk's
 * `import()` can reject; <Suspense> rethrows that rejection during render, so the boundary above must
 * recognise it to offer a reload (which re-fetches the chunk) instead of blanking the whole app.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: unknown; message?: unknown };
  const name = typeof err.name === "string" ? err.name : "";
  const message = typeof err.message === "string" ? err.message : "";
  const text = `${name} ${message}`.toLowerCase();
  return (
    text.includes("failed to fetch dynamically imported module") || // Vite / Chromium
    text.includes("error loading dynamically imported module") || // Vite / Firefox
    text.includes("importing a module script failed") || // Safari / WebKit
    text.includes("loading chunk") || // webpack-style bundlers
    text.includes("loading css chunk")
  );
}
