import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { Sheet } from "./Sheet";

/** A minimal touch event jsdom understands: only `touches` (length + clientY) is read by the drag. */
function makeTouch(type: string, clientY: number | null): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "touches", { value: clientY == null ? [] : [{ clientX: 0, clientY }] });
  return ev;
}

/** jsdom has no layout — pin the height the dismiss ratio measures against. */
function setHeight(el: HTMLElement, value: number): void {
  Object.defineProperty(el, "offsetHeight", { configurable: true, value });
}
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, "scrollTop", { configurable: true, value });
}

function mountSheet(onClose = vi.fn()): {
  onClose: ReturnType<typeof vi.fn>;
  sheet: HTMLElement;
  scrim: HTMLElement;
  body: HTMLElement;
} {
  const utils = render(
    <Sheet onClose={onClose} label="Test sheet">
      <div className="sheet-head">
        <div className="sheet-title">Title</div>
      </div>
      <div className="sheet-body">content</div>
    </Sheet>
  );
  const sheet = utils.container.querySelector(".sheet") as HTMLElement;
  const scrim = utils.container.querySelector(".scrim") as HTMLElement;
  const body = utils.container.querySelector(".sheet-body") as HTMLElement;
  setHeight(sheet, 400); // quarter = 100px to dismiss
  setScrollTop(body, 0);
  return { onClose, sheet, scrim, body };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("Sheet drag-to-dismiss", () => {
  it("closes after a drag past a quarter of its height", () => {
    const { onClose, sheet } = mountSheet();
    act(() => {
      sheet.dispatchEvent(makeTouch("touchstart", 0));
      sheet.dispatchEvent(makeTouch("touchmove", 150)); // 150px > 100 threshold
      sheet.dispatchEvent(makeTouch("touchend", null));
      vi.runAllTimers(); // let the exit transition's fallback fire onClose
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back (does NOT close) on a short drag", () => {
    const { onClose, sheet } = mountSheet();
    act(() => {
      sheet.dispatchEvent(makeTouch("touchstart", 0));
      sheet.dispatchEvent(makeTouch("touchmove", 40)); // below the 100px threshold
      sheet.dispatchEvent(makeTouch("touchend", null));
      vi.runAllTimers();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT arm or block scroll when the body is already scrolled", () => {
    const { onClose, sheet, body } = mountSheet();
    setScrollTop(body, 120);
    const move = makeTouch("touchmove", 200);
    act(() => {
      sheet.dispatchEvent(makeTouch("touchstart", 0));
      sheet.dispatchEvent(move);
      sheet.dispatchEvent(makeTouch("touchend", null));
      vi.runAllTimers();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(move.defaultPrevented).toBe(false);
  });

  it("preventDefault only once the downward drag owns the gesture", () => {
    const { sheet } = mountSheet();
    const pull = makeTouch("touchmove", 120);
    act(() => {
      sheet.dispatchEvent(makeTouch("touchstart", 0));
      sheet.dispatchEvent(pull);
    });
    expect(pull.defaultPrevented).toBe(true);
  });

  it("closes on Escape", () => {
    const { onClose } = mountSheet();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a scrim tap", () => {
    const { onClose, scrim } = mountSheet();
    act(() => {
      fireEvent.click(scrim);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
