import { describe, expect, it } from "vitest";
import { parseToken } from "./JoinScreen";

describe("parseToken — the single normaliser for scan / paste-link / type-code (E03/DEC-103)", () => {
  it("extracts the code from a bare festpilot link", () => {
    expect(parseToken("festpilot.app/j/AB12CD")).toBe("AB12CD");
  });

  it("extracts and upper-cases the code from a full https URL", () => {
    expect(parseToken("https://festpilot.app/j/ab12cd")).toBe("AB12CD");
  });

  it("drops a query or hash a scanned QR may carry after the code", () => {
    expect(parseToken("https://festpilot.app/j/ab12cd?utm=qr")).toBe("AB12CD");
    expect(parseToken("https://festpilot.app/j/AB12CD#ref")).toBe("AB12CD");
  });

  it("accepts a raw typed code with stray spaces or dashes", () => {
    expect(parseToken("  ab 12-cd ")).toBe("AB12CD");
  });

  it("returns empty for blank input so Continue stays disabled", () => {
    expect(parseToken("   ")).toBe("");
    expect(parseToken("")).toBe("");
  });
});
