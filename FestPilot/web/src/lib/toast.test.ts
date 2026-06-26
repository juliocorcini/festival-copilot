import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { _resetToasts, dismissToast, getToasts, showToast, subscribeToasts, toast } from "./toast";

describe("toast store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetToasts();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds an info toast with tone defaults from a bare string", () => {
    showToast("Saved");
    const [t] = getToasts();
    expect(t).toMatchObject({ message: "Saved", tone: "info", icon: "info", durationMs: 2600 });
  });

  it("applies per-tone icon + duration for success and error", () => {
    toast.success("Done");
    toast.error("Nope");
    const [ok, bad] = getToasts();
    expect(ok).toMatchObject({ tone: "success", icon: "check_circle", durationMs: 2600 });
    expect(bad).toMatchObject({ tone: "error", icon: "error", durationMs: 4200 });
  });

  it("coalesces same-key toasts — the latest replaces, never piling up", () => {
    showToast({ message: "Saved A", key: "favorite" });
    showToast({ message: "Removed A", key: "favorite" });
    const list = getToasts();
    expect(list).toHaveLength(1);
    expect(list[0]!.message).toBe("Removed A");
  });

  it("caps the stack at three, dropping the oldest on a burst", () => {
    showToast("one");
    showToast("two");
    showToast("three");
    showToast("four");
    expect(getToasts().map((t) => t.message)).toEqual(["two", "three", "four"]);
  });

  it("auto-dismisses after its duration", () => {
    showToast({ message: "bye", durationMs: 1000 });
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(999);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
  });

  it("keeps a sticky toast (durationMs 0) until dismissed", () => {
    const id = showToast({ message: "stay", durationMs: 0 });
    vi.advanceTimersByTime(60_000);
    expect(getToasts()).toHaveLength(1);
    dismissToast(id);
    expect(getToasts()).toHaveLength(0);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToasts(listener);
    showToast("a");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    showToast("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns a stable snapshot reference between changes", () => {
    showToast("a");
    const first = getToasts();
    expect(getToasts()).toBe(first);
    showToast("b");
    expect(getToasts()).not.toBe(first);
  });
});
