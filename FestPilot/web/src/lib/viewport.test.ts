import { afterEach, describe, expect, it } from "vitest";
import { applyAppHeight } from "./viewport";

function appHeight(): string {
  return document.documentElement.style.getPropertyValue("--app-height");
}

afterEach(() => {
  document.documentElement.style.removeProperty("--app-height");
});

describe("applyAppHeight (E01/DEC-089)", () => {
  it("writes the measured height into --app-height as px", () => {
    expect(appHeight()).toBe("");
    applyAppHeight(844);
    expect(appHeight()).toBe("844px");
  });

  it("rounds sub-pixel heights so the shell never overflows by a fraction", () => {
    applyAppHeight(812.4);
    expect(appHeight()).toBe("812px");
    applyAppHeight(667.8);
    expect(appHeight()).toBe("668px");
  });

  it("updates in place on each call (one value, latest wins — rotation/resize)", () => {
    applyAppHeight(844);
    applyAppHeight(390);
    expect(appHeight()).toBe("390px");
  });
});
