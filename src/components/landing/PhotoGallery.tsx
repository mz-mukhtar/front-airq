"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { GalleryPhoto } from "./photo-data";

/**
 * Photo grid for the landing-page sets, with the featured frame on a rotation.
 *
 * The order is a ring, not a shuffle: the lead tile is whichever photo sits at
 * `offset`, and the thumbnails are the rest in sequence. Advancing turns
 * `1 | 2 3 4 5` into `2 | 3 4 5 1`, so every photo keeps its neighbours and the
 * set stays predictable however many times you click.
 *
 * These are phone photos from several install days — mixed sizes, orientations
 * and white balance. Three things reconcile that without touching the originals:
 *
 *  - next/image resizes and re-encodes to AVIF/WebP at the rendered size, so a
 *    280 KB JPEG never ships whole to a phone.
 *  - `.field-photo` in globals.css applies one mild grade across the batch.
 *  - every tile in a row uses the SAME aspect ratio. That one is structural: a
 *    grid mixing 4/3 and 3/4 tiles stretches the shorter figure to the row
 *    height, and because the caption is positioned against the figure it then
 *    lands below the photo on blank background. Uniform aspect boxes plus
 *    object-cover keep each caption over its own image.
 */

/** Image + scrim + caption. The parent owns the aspect box and the border. */
function PhotoFrame({
  photo,
  sizes,
  captionClass,
}: {
  photo: GalleryPhoto;
  sizes: string;
  captionClass: string;
}) {
  return (
    <>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        style={{ objectPosition: photo.focus ?? "center" }}
        className="field-photo object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
      />
      {/* Scrim: these are bright daylight photos, and white-on-sky is unreadable. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 font-medium text-white drop-shadow ${captionClass}`}
      >
        {photo.caption}
      </span>
    </>
  );
}

export function PhotoGallery({
  photos,
  /** `featured` gives the first photo a full-width lead tile; `row` treats them equally. */
  variant = "featured",
}: {
  photos: GalleryPhoto[];
  variant?: "featured" | "row";
}) {
  const [offset, setOffset] = useState(0);

  if (photos.length === 0) return null;

  // A single photo (or the `row` variant) has nothing to rotate — one wide tile
  // reads better than a lead above an empty grid.
  if (variant === "row" || photos.length === 1) {
    const single = photos.length === 1;
    return (
      <div
        className={single ? "" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}
      >
        {photos.map((photo) => (
          // The figure IS the aspect box — nothing between it and the grid cell
          // can stretch, so a caption can never drift off its image.
          <figure
            key={photo.src}
            className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 ${
              single ? "aspect-[16/9]" : "aspect-[4/3]"
            }`}
          >
            <PhotoFrame
              photo={photo}
              sizes={
                single
                  ? "(max-width: 1280px) 100vw, 1216px"
                  : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
              }
              captionClass={single ? "p-4 text-sm sm:p-5 sm:text-base" : "p-3 text-xs"}
            />
          </figure>
        ))}
      </div>
    );
  }

  const count = photos.length;
  // Rotate the ring so `offset` leads and the rest follow in order.
  const ordered = [...photos.slice(offset), ...photos.slice(0, offset)];
  const [lead, ...rest] = ordered;

  const advance = () => setOffset((current) => (current + 1) % count);
  /** Promote the thumbnail at display position `i` (0-based among thumbs). */
  const promote = (i: number) => setOffset((current) => (current + i + 1) % count);

  return (
    <div className="space-y-4">
      <figure className="group relative aspect-[16/9] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
        <PhotoFrame
          photo={lead}
          sizes="(max-width: 1280px) 100vw, 1216px"
          captionClass="p-4 pr-28 text-sm sm:p-5 sm:pr-32 sm:text-base"
        />

        {/* Next sits on the lead frame rather than under the grid — it belongs
            to the photo it advances, and there is dead space in that corner. */}
        <button
          type="button"
          onClick={advance}
          aria-label={`Show next photo (${(offset % count) + 1} of ${count})`}
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:bottom-4 sm:right-4 sm:text-sm"
        >
          <span className="tabular-nums">
            {(offset % count) + 1}/{count}
          </span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </figure>

      {/* Equal tiles. Square is the forgiving choice for a set mixing portrait
          and landscape sources — it crops both by the same rule. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {rest.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => promote(i)}
            aria-label={`Feature this photo: ${photo.caption}`}
            className="group relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 text-left transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-800"
          >
            <PhotoFrame
              photo={photo}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 296px"
              captionClass="p-3 text-xs"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
