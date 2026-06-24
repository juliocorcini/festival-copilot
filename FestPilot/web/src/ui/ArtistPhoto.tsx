/**
 * Shared artist image (DEC-061 / R5.4). Renders the CDN photo right-sized via `?width=`, falling
 * back to a branded initials chip when there's no photo or the image fails to load. One component
 * for every surface (swipe, grid, timetable, lineup, my plan, now/next, stage sheet).
 */
import { useState } from "react";
import { initialsOf } from "../data/identity";
import { artistPhotoSrc } from "../lib/photo";

export function ArtistPhoto({
  src,
  name,
  width,
  className,
}: {
  src: string | null;
  name: string;
  /** CDN resize width — pass a per-surface value from `PHOTO_WIDTH`. */
  width: number;
  className?: string;
}): JSX.Element {
  const [failed, setFailed] = useState(false);
  const cls = `artphoto${className ? ` ${className}` : ""}`;

  if (!src || failed) {
    return (
      <span className={`${cls} artphoto-ph`} aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }
  return (
    <img
      className={cls}
      src={artistPhotoSrc(src, width)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
