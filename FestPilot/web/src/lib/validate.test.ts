import { describe, expect, it } from "vitest";
import { isValidEmail } from "./validate";

describe("isValidEmail (DEC-060)", () => {
  it("accepts a well-formed address", () => {
    expect(isValidEmail("julio@example.com")).toBe(true);
    expect(isValidEmail("  a.b+tag@sub.domain.io ")).toBe(true);
  });

  it("rejects malformed or empty input", () => {
    for (const bad of ["", "   ", "nope", "a@b", "a@b.", "@x.com", "a b@x.com", "a@x .com"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});
