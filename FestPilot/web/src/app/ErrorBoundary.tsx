import { Component, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError } from "../lib/chunkError";
import { ErrorState } from "../ui/states";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide safety net for render-time crashes. <Suspense> only handles a lazy chunk's *pending*
 * state — a *rejected* `import()` (a code-split tab that couldn't download on flaky on-site Wi-Fi) is
 * rethrown during render and, without a boundary above it, unmounts the whole tree into a blank
 * screen. This catches it and shows the standard recover UI (ErrorState) with a reload.
 *
 * Mounted twice: once around the whole app (main.tsx) as the catch-all, and once inside each layout
 * above <Suspense> (AppLayout/StackLayout) so a failed tab recovers *inside* the shell — the bottom
 * nav stays, and navigating to another tab remounts this boundary via the layout's route `key`,
 * clearing the error with no reload. Must be a class: only class components can implement
 * getDerivedStateFromError / componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for diagnosis; never swallow silently (no PII, no transport coupling).
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private readonly reload = (): void => {
    // A rejected lazy() promise is memoised, so a soft re-render can't recover it — a full reload
    // re-fetches the chunk (the service worker may even serve it from cache).
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error);
    return (
      <ErrorState
        title={chunk ? "Couldn’t load this section" : "Something went wrong"}
        message={
          chunk
            ? "This part didn’t download — check your connection, then reload to try again."
            : "An unexpected error occurred. Reloading usually fixes it."
        }
        onRetry={this.reload}
      />
    );
  }
}
