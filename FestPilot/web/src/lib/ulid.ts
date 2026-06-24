// Dependency-free ULID (Crockford base32, time + randomness) — mirror of server/src/db/ids.ts.
// Used to mint the stable anonymous auth token id; the server validates the same 26-char shape.

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
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
  for (let i = 0; i < RANDOM_LEN; i++) out += ENCODING[bytes[i]! & 0x1f];
  return out;
}

/** Generate a 26-char ULID. */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}
