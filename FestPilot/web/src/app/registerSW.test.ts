import { afterEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, checkForUpdate, registerServiceWorker } from "./registerSW";

function setServiceWorker(register: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistration: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() },
  });
}

function stubServiceWorker(value: unknown): void {
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value });
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

  it("registers a version-stamped /sw.js on window load in production", async () => {
    vi.stubEnv("PROD", true);
    const register = vi.fn().mockResolvedValue({});
    setServiceWorker(register);
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
    // Version-stamped URL so each release is a distinct worker the browser will re-install.
    expect(register.mock.calls[0][0]).toMatch(/^\/sw\.js\?v=.+/);
  });
});

describe("checkForUpdate", () => {
  it("reports unsupported when there is no registration", async () => {
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(undefined), controller: {} });
    expect(await checkForUpdate()).toBe("unsupported");
  });

  it("reports a waiting worker as an available update", async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: {}, installing: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg), controller: {} });
    expect(await checkForUpdate()).toBe("updated");
    expect(reg.update).toHaveBeenCalled();
  });

  it("reports current when controlled and nothing is waiting/installing", async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: null, installing: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg), controller: {} });
    expect(await checkForUpdate()).toBe("current");
  });

  it("does not claim an update on the very first install (no controller yet)", async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: {}, installing: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg), controller: null });
    expect(await checkForUpdate()).toBe("current");
  });
});

describe("applyUpdate", () => {
  it("tells the waiting worker to skip waiting", async () => {
    const postMessage = vi.fn();
    const reg = { waiting: { postMessage } };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg) });
    await applyUpdate();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});
