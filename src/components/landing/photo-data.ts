/**
 * Landing-page photography.
 *
 * Data lives apart from the gallery components so adding a photo is a one-line
 * change to an array, not an edit to JSX. Drop the file in `public/field` or
 * `public/lab`, add an entry here, and both the grid and the spotlight pick it
 * up.
 *
 * Alt text describes the work in the frame and never names anyone: we cannot
 * verify identities, and appearing in a photo is not consent to be labelled by
 * name on a public page.
 */

export interface GalleryPhoto {
  src: string;
  alt: string;
  caption: string;
  /** Bias the crop when a tall source is squared off in the grid. */
  focus?: string;
}

export const FIELD_PHOTOS: GalleryPhoto[] = [
  {
    // Leads the section: the widest context shot, and the only frame holding
    // the sensor, the traffic it measures and the skyline all at once.
    src: "/field/bridge-mount.jpg",
    alt: "An engineer fastening a sensor mount to the railing of a raised walkway above a busy Addis Ababa intersection, with a bus rapid transit lane, an elevated roadway and high-rise buildings behind.",
    caption: "Mounting a station above the traffic it measures",
    focus: "center 40%",
  },
  {
    src: "/field/station-commissioning.jpg",
    alt: "Three members of the project team standing beside a newly installed air quality sensor and its stainless steel equipment cabinet on a walkway overlooking a major interchange.",
    caption: "Commissioning a station at a major interchange",
    focus: "center 35%",
  },
  {
    src: "/field/column-mount.jpg",
    alt: "An engineer on a ladder attaching a sensor enclosure to a concrete column at a building entrance while a colleague steadies the ladder.",
    caption: "Column mount at a building entrance",
    focus: "center 30%",
  },
  {
    src: "/field/pharmacy-canopy.jpg",
    alt: "Two engineers on the entrance canopy of a pharmacy building fitting a sensor enclosure above the street.",
    caption: "Fitting an enclosure above a pharmacy",
    focus: "center 30%",
  },
  {
    src: "/field/bench-configuration.jpg",
    alt: "Two engineers indoors preparing a sensor unit for deployment, one working at a laptop while the other connects the enclosure's power lead.",
    caption: "Bench configuration before a unit goes up",
    focus: "center",
  },
];

export const LAB_PHOTOS: GalleryPhoto[] = [
  {
    src: "/lab/bench-assembly.jpg",
    alt: "Two engineers at a university electronics bench wiring sensor modules by hand, with an oscilloscope, bench power supply and anti-static packaging around them.",
    caption: "Wiring sensor modules at the bench",
    focus: "center",
  },
];
