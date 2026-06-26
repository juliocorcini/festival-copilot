import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/ingest/hash";

describe("sha256Hex", () => {
  it("matches the canonical SHA-256 test vectors (lower-case hex)", async () => {
    // Well-known NIST vectors — pin the exact digest, not just the shape, so a future swap of the
    // hashing primitive (used for ingest change-detection) can't silently change the contract.
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("always returns 64 lower-case hex chars", async () => {
    expect(await sha256Hex("FestPilot")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and collision-sensitive", async () => {
    expect(await sha256Hex("same-input")).toBe(await sha256Hex("same-input"));
    expect(await sha256Hex("a")).not.toBe(await sha256Hex("b"));
  });
});
