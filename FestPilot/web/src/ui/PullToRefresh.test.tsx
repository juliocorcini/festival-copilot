import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { PullToRefresh } from "./PullToRefresh";

/** A minimal touch event jsdom understands: only `touches` (length + clientY) is read by the gesture. */
function makeTouch(type: string, clientY: number | null): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "touches", {
    value: clientY == null ? [] : [{ clientX: 0, clientY }],
  });
  return ev;
}

/** jsdom has no layout, so pin scrollTop explicitly to model "at the top" vs "already scrolled". */
function setScrollTop(el: HTMLElement, value: number): void {
  Object.defineProperty(el, "scrollTop", { configurable: true, value });
}

function mountPTR(onRefresh = vi.fn()): { onRefresh: ReturnType<typeof vi.fn>; scroller: HTMLElement } {
  const utils = render(
    <div className="scr">
      <PullToRefresh onRefresh={onRefresh} />
    </div>
  );
  const scroller = utils.container.querySelector(".scr") as HTMLElement;
  setScrollTop(scroller, 0);
  return { onRefresh, scroller };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("PullToRefresh gesture", () => {
  it("fires onRefresh once after a generous pull from the top", async () => {
    const { onRefresh, scroller } = mountPTR();
    act(() => {
      scroller.dispatchEvent(makeTouch("touchstart", 0));
      scroller.dispatchEvent(makeTouch("touchmove", 600)); // resisted ~78px > 64 trigger
      scroller.dispatchEvent(makeTouch("touchend", null));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.runAllTimersAsync(); // let the min-spin hold resolve cleanly
    });
  });

  it("does NOT fire on a short pull below the trigger", () => {
    const { onRefresh, scroller } = mountPTR();
    act(() => {
      scroller.dispatchEvent(makeTouch("touchstart", 0));
      scroller.dispatchEvent(makeTouch("touchmove", 20)); // resisted ~16px
      scroller.dispatchEvent(makeTouch("touchend", null));
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("does NOT fire or block scrolling when the content is already scrolled", () => {
    const { onRefresh, scroller } = mountPTR();
    setScrollTop(scroller, 120);
    const move = makeTouch("touchmove", 600);
    act(() => {
      scroller.dispatchEvent(makeTouch("touchstart", 0));
      scroller.dispatchEvent(move);
      scroller.dispatchEvent(makeTouch("touchend", null));
    });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(move.defaultPrevented).toBe(false);
  });

  it("preventDefault only while actively pulling down — never on a scroll-up", () => {
    const { scroller } = mountPTR();
    const pull = makeTouch("touchmove", 600);
    act(() => {
      scroller.dispatchEvent(makeTouch("touchstart", 0));
      scroller.dispatchEvent(pull);
    });
    expect(pull.defaultPrevented).toBe(true);

    const up = makeTouch("touchmove", -40);
    act(() => {
      scroller.dispatchEvent(makeTouch("touchstart", 100));
      scroller.dispatchEvent(up);
    });
    expect(up.defaultPrevented).toBe(false);
  });
});
