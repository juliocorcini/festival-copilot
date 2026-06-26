import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { canVibrate, haptic, initHaptics } from "./haptics";

function setVibrate(fn: ((p: number | number[]) => boolean) | undefined): void {
  if (fn) Object.defineProperty(navigator, "vibrate", { configurable: true, value: fn });
  else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "vibrate");
}

afterEach(() => {
  setVibrate(undefined);
  localStorage.clear();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("canVibrate", () => {
  it("is true only when the Vibration API exists", () => {
    setVibrate(undefined);
    expect(canVibrate()).toBe(false);
    setVibrate(vi.fn());
    expect(canVibrate()).toBe(true);
  });
});

describe("haptic", () => {
  it("no-ops when the device can't vibrate (e.g. iOS Safari)", () => {
    setVibrate(undefined);
    expect(() => haptic("success")).not.toThrow();
  });

  it("no-ops when the user disabled haptics", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    localStorage.setItem("fp.haptics", "0");
    haptic("select");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("fires the named pattern when supported and enabled (default ON)", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    haptic("light");
    haptic("select");
    haptic("success");
    expect(vibrate).toHaveBeenNthCalledWith(1, 8);
    expect(vibrate).toHaveBeenNthCalledWith(2, 12);
    expect(vibrate).toHaveBeenNthCalledWith(3, [12, 28, 18]);
  });

  it("defaults to a light tap for an unknown kind", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    // @ts-expect-error — exercising the runtime fallback
    haptic("nope");
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it("swallows engine errors (no user gesture yet)", () => {
    setVibrate(() => {
      throw new Error("must be triggered by a user gesture");
    });
    expect(() => haptic()).not.toThrow();
  });
});

describe("initHaptics (global tap delegate)", () => {
  beforeAll(() => initHaptics());

  // A genuine tap = a `click` (the browser only emits it for down+up on the same target, not a scroll).
  const tap = (el: Element): void => {
    el.dispatchEvent(new Event("click", { bubbles: true }));
  };

  it("taps lightly on a plain button click", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    tap(btn);
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it("does NOT buzz on pointerdown (scroll/drag) — only on a confirmed tap", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    // Starting a touch (pointerdown) that turns into a scroll must stay silent…
    btn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(vibrate).not.toHaveBeenCalled();
    // …only the resulting click (a real tap) buzzes.
    tap(btn);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it("honors a data-haptic upgrade on the control", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const btn = document.createElement("button");
    btn.setAttribute("data-haptic", "select");
    document.body.appendChild(btn);
    tap(btn);
    expect(vibrate).toHaveBeenCalledWith(12);
  });

  it("skips controls opted out with data-haptic=off", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const btn = document.createElement("button");
    btn.setAttribute("data-haptic", "off");
    document.body.appendChild(btn);
    tap(btn);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("skips disabled controls and non-controls", () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const btn = document.createElement("button");
    btn.disabled = true;
    const div = document.createElement("div");
    document.body.append(btn, div);
    tap(btn);
    tap(div);
    expect(vibrate).not.toHaveBeenCalled();
  });
});
