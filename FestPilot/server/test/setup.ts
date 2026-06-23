// Ensure Web Crypto (crypto.subtle / getRandomValues) is available under Node.
// Production (Workers) has it globally; Node < 20 may not expose it as a global.
import { webcrypto } from "node:crypto";

const globalRef = globalThis as { crypto?: Crypto };
if (!globalRef.crypto) {
  globalRef.crypto = webcrypto as unknown as Crypto;
}
