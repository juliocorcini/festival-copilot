// Minimal, dependency-free ULID generator (Crockford base32, time + randomness).
// ULIDs are lexicographically sortable by creation time, which is convenient for
// "latest first" scans. Uses Web Crypto (available in Workers and modern Node).

export type IdFactory = () => string;

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I, L, O, U)
const ENCODING_LEN = 32;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let value = now;
  let out = "";
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = value % ENCODING_LEN;
    out = ENCODING[mod] + out;
    value = (value - mod) / ENCODING_LEN;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < RANDOM_LEN; i++) {
    // Mask to 5 bits for a uniform mapping onto the 32-char alphabet.
    out += ENCODING[bytes[i]! & 0x1f];
  }
  return out;
}

/** Generate a 26-char ULID. */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}
