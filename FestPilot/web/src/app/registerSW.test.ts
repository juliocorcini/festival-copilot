import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./registerSW";

function setServiceWorker(register: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistration: vi.fn().mockResolvedValue(undefined) },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("registerServiceWorker", () => {
  it("does not register outside production", () => {
    vi.stubEnv("PROD", false);
    const register = vi.fn();
    setServiceWorker(register);
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    expect(register).not.toHaveBeenCalled();
  });

  it("registers /sw.js on window load in production", async () => {
    vi.stubEnv("PROD", true);
    const register = vi.fn().mockResolvedValue({});
    setServiceWorker(register);
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
