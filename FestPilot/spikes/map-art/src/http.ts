/**
 * Tiny HTTP helpers via `curl`.
 *
 * Why curl and not Node's global fetch? Node 18's undici **hangs** on some of the
 * geo endpoints we use (notably the Flanders WMS), while curl returns in ~2 s.
 * For a build-time generator, shelling out to curl is the reliable choice.
 */
import { execFileSync } from "node:child_process";

export function curlPostForm(url: string, body: string, timeoutSec = 120): Buffer {
  return execFileSync(
    "curl",
    ["-s", "--max-time", String(timeoutSec), "-X", "POST",
      "-H", "Content-Type: application/x-www-form-urlencoded",
      "--data-binary", body, url],
    { maxBuffer: 512 * 1024 * 1024 },
  );
}

export function curlGetToFile(url: string, outPath: string, timeoutSec = 120): void {
  execFileSync("curl", ["-sL", "--max-time", String(timeoutSec), "-o", outPath, url], {
    stdio: "ignore",
  });
}
