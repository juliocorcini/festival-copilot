/**
 * Keyboard "skip to content" bypass (WCAG 2.4.1): the first focusable element on the page, hidden
 * off-screen until focused, then shown as a pill. Jumps focus to the screen's <main id="main"
 * tabIndex={-1}>, so keyboard/AT users don't have to tab through the chrome on every navigation.
 */
export function SkipLink(): JSX.Element {
  return (
    <a className="skip-link" href="#main">
      Skip to content
    </a>
  );
}
