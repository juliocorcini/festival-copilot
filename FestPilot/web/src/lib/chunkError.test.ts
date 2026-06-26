import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunkError";

describe("isChunkLoadError", () => {
  it("recognises Vite/Chromium and Firefox dynamic-import failures", () => {
    expect(
      isChunkLoadError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://festpilot.pages.dev/assets/MapScreen-a1b2c3.js"
        )
      )
    ).toBe(true);
    expect(
      isChunkLoadError(new TypeError("error loading dynamically imported module"))
    ).toBe(true);
  });

  it("recognises Safari/WebKit module-script failures", () => {
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("recognises webpack-style chunk-load failures (incl. CSS chunks)", () => {
    expect(isChunkLoadError(new Error("Loading chunk 42 failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 7 failed."))).toBe(true);
  });

  it("is case-insensitive and matches on known phrases, not the error name token", () => {
    expect(isChunkLoadError(new Error("FAILED TO FETCH DYNAMICALLY IMPORTED MODULE"))).toBe(true);
    // A bare `ChunkLoadError` name with an unrelated message must NOT match — we key off phrases.
    const named = Object.assign(new Error("boom"), { name: "ChunkLoadError" });
    expect(isChunkLoadError(named)).toBe(false);
  });

  it("does not misfire on ordinary render errors or non-error values", () => {
    expect(
      isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))
    ).toBe(false);
    expect(isChunkLoadError(new Error("something went wrong"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError("just a string")).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });
});
