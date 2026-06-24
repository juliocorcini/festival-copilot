import { describe, expect, it } from "vitest";
import { artistPhotoSrc } from "./photo";

describe("artistPhotoSrc (DEC-061)", () => {
  it("URL-encodes spaces in the path and appends the width resizer", () => {
    const url = "https://artist-lineup-cdn.tomorrowland.com/233262902-Presspic Bassbrain - 4.jpg";
    expect(artistPhotoSrc(url, 160)).toBe(
      "https://artist-lineup-cdn.tomorrowland.com/233262902-Presspic%20Bassbrain%20-%204.jpg?width=160"
    );
  });

  it("uses & when the URL already carries a query, and rounds the width", () => {
    expect(artistPhotoSrc("https://cdn.test/a.jpg?v=2", 160.6)).toBe("https://cdn.test/a.jpg?v=2&width=161");
  });

  it("does not double-encode an already-encoded path", () => {
    expect(artistPhotoSrc("https://cdn.test/a%20b.jpg", 96)).toBe("https://cdn.test/a%20b.jpg?width=96");
  });
});
