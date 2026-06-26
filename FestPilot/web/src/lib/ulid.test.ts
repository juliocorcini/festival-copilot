import { describe, expect, it } from "vitest";
import { ulid } from "./ulid";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I, L, O, U)

describe("ulid", () => {
  it("is 26 Crockford-base32 chars", () => {
    const id = ulid();
    expect(id).toHaveLength(26);
    for (const ch of id) expect(ENCODING).toContain(ch);
  });

  it("encodes the timestamp big-endian in the first 10 chars", () => {
    expect(ulid(0).slice(0, 10)).toBe("0000000000");
    expect(ulid(1).slice(0, 10)).toBe("0000000001");
    expect(ulid(31).slice(0, 10)).toBe("000000000Z"); // 31 → last symbol 'Z'
    expect(ulid(32).slice(0, 10)).toBe("0000000010"); // base32 carry into the next digit
  });

  it("keeps the time prefix lexicographically sortable (monotonic with time)", () => {
    const earlier = ulid(1_700_000_000_000).slice(0, 10);
    const later = ulid(1_700_000_001_000).slice(0, 10);
    expect(later > earlier).toBe(true);
    expect(ulid(1_700_000_000_000).slice(0, 10)).toBe(earlier); // same instant → same prefix
  });

  it("randomizes the 16-char suffix (two ids at the same instant differ)", () => {
    const a = ulid(1_700_000_000_000);
    const b = ulid(1_700_000_000_000);
    expect(a.slice(0, 10)).toBe(b.slice(0, 10)); // identical time prefix
    expect(a.slice(10)).not.toBe(b.slice(10)); // independent randomness
    expect(a).not.toBe(b);
  });
});
