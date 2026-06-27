/**
 * Base bottom sheet (Phase 7 — D3, Q4 = all sheets). One component for the app's recurring
 * `scrim + sheet` pattern: it renders the dimmed backdrop, the rounded sheet, the drag grip, and wires
 * the shared behaviour every sheet needs — drag-to-dismiss (follow the finger, flick or spring back),
 * Escape to close, focus into the dialog on open and back to the trigger on close, and `aria-modal`.
 *
 * Callers provide only the inner content (their own `.sheet-head` + `.sheet-body`); pass `label` (or
 * `labelledBy`) so the dialog has an accessible name, and an optional `className` for per-sheet sizing.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSheetDrag } from "./useSheetDrag";

interface SheetProps {
  onClose: () => void;
  /** Accessible name for the dialog (use when there is no visible title element to point at). */
  label?: string;
  /** id of the visible title element, when present (preferred over `label`). */
  labelledBy?: string;
  /** Extra class on the `.sheet` element for per-sheet sizing/layout. */
  className?: string;
  children: ReactNode;
}

export function Sheet({ onClose, label, labelledBy, className, children }: SheetProps): JSX.Element {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // A11y: focus the dialog on open, close on Esc, trap Tab within the dialog, and return focus to the
  // trigger on unmount. The trap completes the WAI-ARIA modal-dialog pattern (`aria-modal` already
  // hides the background from AT; this also keeps keyboard focus from escaping behind the scrim).
  useEffect(() => {
    const previouslyFocused = (typeof document !== "undefined" ? document.activeElement : null) as
      | HTMLElement
      | null;
    // preventScroll: the sheet animates up from translateY(100%); focusing without it makes the
    // browser scroll the background to reveal the off-screen dialog — a visible jump.
    sheetRef.current?.focus({ preventScroll: true });

    const trapTab = (e: KeyboardEvent): void => {
      const root = sheetRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const active = (document.activeElement as HTMLElement | null) ?? null;
      // No focusable children: keep focus pinned on the dialog container itself.
      if (focusable.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Wrap at the edges, and pull focus back in if it sits on the container or has escaped the dialog.
      if (e.shiftKey) {
        if (active === first || active === root || !root.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || active === root || !root.contains(active)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") trapTab(e);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  useSheetDrag(sheetRef, scrimRef, onClose);

  // Portal to <body> so the scrim + sheet are positioned against the viewport, never a transformed/
  // scrolled ancestor (`.world{will-change:transform}`, page transitions). With `position: fixed`, this
  // kills the "menu stuck to the scrolled page" class of bugs for every sheet at once (DEC-078).
  return createPortal(
    <>
      <div ref={scrimRef} className="scrim on" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`sheet on${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </>,
    document.body
  );
}
