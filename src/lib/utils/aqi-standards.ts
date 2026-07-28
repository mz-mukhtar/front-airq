/**
 * Selectable air-quality index standards.
 *
 * Different regions publish different indices over the same concentration, so
 * "the AQI" is not a single number — it depends on which scale you report
 * against. PurpleAir, IQAir and WAQI all let the reader pick; this module is
 * that choice, and every surface (map dots, popups, cards, legend) reads its
 * category and color from here so they can never disagree.
 *
 * All standards are computed from **PM2.5 only**. That matches PurpleAir's US
 * EPA AQI and follows from the product decision to drop PM10 from the public
 * surfaces: an index the reader cannot trace back to a displayed number is
 * worse than a narrower one. PM10 sub-indices can be layered in later if PM10
 * comes back to the UI.
 */

export type AqiStandardId = "us_epa" | "eu_eaqi" | "uk_daqi" | "who_2021" | "raw_pm25";

export interface AqiCategory {
  label: string;
  /** Compact label for tight spots (map legend, marker tooltip). */
  shortLabel: string;
  color: string;
  /** Readable text color on top of `color`. */
  textColor: string;
  /**
   * Inclusive upper bound of the PM2.5 concentration (µg/m³) in this category.
   * The final category must be Infinity. Categories are ordered best → worst,
   * which makes both classification and the legend fall out of one list.
   */
  pm25Max: number;
}

export interface AqiStandard {
  id: AqiStandardId;
  /** Full name for the selector list. */
  name: string;
  /** Short name for the map badge. */
  shortName: string;
  /** Who publishes it — shown as the selector subtitle. */
  source: string;
  /**
   * Full citation of the body that defines this scale. Shown wherever its
   * category names appear: labels like "Unhealthy for Sensitive Groups" are
   * the EPA's wording, and presenting them uncredited implies an authority
   * this dashboard does not have.
   */
  attribution: string;
  /**
   * How *this dashboard* computes the number, including where that departs
   * from the published method. Every scale here is applied to the latest
   * instantaneous PM2.5 reading, while most official indices are defined over
   * a 24-hour average — a difference that materially changes the number during
   * a short spike, so it is stated rather than buried.
   */
  methodology: string;
  /** Unit/label shown under the big number ("AQI", "EAQI", "µg/m³"). */
  valueLabel: string;
  categories: AqiCategory[];
  /** Index value for a PM2.5 concentration (µg/m³). */
  fromPm25: (pm25: number) => number;
  /** How the index value is written out. */
  formatValue: (value: number) => string;
}

/** Piecewise-linear interpolation between index breakpoints (the EPA formula). */
function interpolate(
  c: number,
  breakpoints: Array<[number, number, number, number]>
): number {
  for (const [cLo, cHi, iLo, iHi] of breakpoints) {
    if (c <= cHi) {
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
    }
  }
  return breakpoints[breakpoints.length - 1][3];
}

/** Ordinal band index (1-based) for a concentration against ascending cut points. */
function bandIndex(c: number, cutPoints: number[]): number {
  for (let i = 0; i < cutPoints.length; i += 1) {
    if (c <= cutPoints[i]) return i + 1;
  }
  return cutPoints.length + 1;
}

const roundInt = (value: number) => String(Math.round(value));
const oneDecimal = (value: number) => value.toFixed(1);

// --- US EPA AQI (May 2024 PM2.5 breakpoints) --------------------------------
// Keeps the app's existing palette rather than the official swatches: the EPA
// yellow (#ffff00) is unreadable on light backgrounds and the rest of the UI is
// already built on this ramp.
const US_EPA_PM25_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0.0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 500],
];

const US_EPA: AqiStandard = {
  id: "us_epa",
  name: "US EPA AQI",
  shortName: "US AQI",
  source: "US Environmental Protection Agency · 0–500",
  attribution:
    "Air Quality Index and category names defined by the U.S. Environmental Protection Agency (EPA), using the revised PM2.5 breakpoints effective May 2024.",
  methodology:
    "Sub-index interpolated from the station's latest PM2.5 reading. The official AQI is based on a 24-hour average, so short spikes read higher here than they would in an EPA report.",
  valueLabel: "AQI",
  formatValue: roundInt,
  fromPm25: (pm25) => interpolate(Math.max(0, pm25), US_EPA_PM25_BREAKPOINTS),
  categories: [
    { label: "Good", shortLabel: "Good", color: "#22c55e", textColor: "#ffffff", pm25Max: 9.0 },
    { label: "Moderate", shortLabel: "Moderate", color: "#eab308", textColor: "#1f2937", pm25Max: 35.4 },
    {
      label: "Unhealthy for Sensitive Groups",
      shortLabel: "Unhealthy (SG)",
      color: "#f97316",
      textColor: "#ffffff",
      pm25Max: 55.4,
    },
    { label: "Unhealthy", shortLabel: "Unhealthy", color: "#dc2626", textColor: "#ffffff", pm25Max: 125.4 },
    { label: "Very Unhealthy", shortLabel: "Very Unhealthy", color: "#9333ea", textColor: "#ffffff", pm25Max: 225.4 },
    { label: "Hazardous", shortLabel: "Hazardous", color: "#7f1d1d", textColor: "#ffffff", pm25Max: Infinity },
  ],
};

// --- European Air Quality Index (EEA) ---------------------------------------
// Six bands, reported as the band number 1–6 with the EEA's own palette.
const EU_EAQI_CUTS = [10, 20, 25, 50, 75];

const EU_EAQI: AqiStandard = {
  id: "eu_eaqi",
  name: "European AQI (EAQI)",
  shortName: "EAQI",
  source: "European Environment Agency · bands 1–6",
  attribution:
    "European Air Quality Index bands and category names defined by the European Environment Agency (EEA), with the EEA's published colour scale.",
  methodology:
    "Band taken from the station's latest PM2.5 reading. The published EAQI uses 24-hour running means across several pollutants; this is the PM2.5 band alone.",
  valueLabel: "EAQI",
  formatValue: roundInt,
  fromPm25: (pm25) => bandIndex(Math.max(0, pm25), EU_EAQI_CUTS),
  categories: [
    { label: "Good", shortLabel: "Good", color: "#50f0e6", textColor: "#1f2937", pm25Max: 10 },
    { label: "Fair", shortLabel: "Fair", color: "#50ccaa", textColor: "#1f2937", pm25Max: 20 },
    { label: "Moderate", shortLabel: "Moderate", color: "#f0e641", textColor: "#1f2937", pm25Max: 25 },
    { label: "Poor", shortLabel: "Poor", color: "#ff5050", textColor: "#ffffff", pm25Max: 50 },
    { label: "Very poor", shortLabel: "Very poor", color: "#960032", textColor: "#ffffff", pm25Max: 75 },
    { label: "Extremely poor", shortLabel: "Extremely poor", color: "#7d2181", textColor: "#ffffff", pm25Max: Infinity },
  ],
};

// --- UK Daily Air Quality Index (DEFRA) -------------------------------------
// Ten index values grouped into four reporting bands, which is how DEFRA
// presents it: the number carries the detail, the color carries the band.
const UK_DAQI_CUTS = [11, 23, 35, 41, 47, 53, 58, 64, 70];

const UK_DAQI: AqiStandard = {
  id: "uk_daqi",
  name: "UK DAQI",
  shortName: "DAQI",
  source: "UK DEFRA · index 1–10",
  attribution:
    "Daily Air Quality Index, its 1–10 scale and Low/Moderate/High/Very High bands defined by the UK Department for Environment, Food & Rural Affairs (DEFRA), on advice from COMEAP.",
  methodology:
    "Index taken from the station's latest PM2.5 reading. DAQI is published as a daily figure over a 24-hour mean, so this is a live approximation of it.",
  valueLabel: "DAQI",
  formatValue: roundInt,
  fromPm25: (pm25) => bandIndex(Math.max(0, pm25), UK_DAQI_CUTS),
  categories: [
    { label: "Low (1–3)", shortLabel: "Low", color: "#31cf00", textColor: "#1f2937", pm25Max: 35 },
    { label: "Moderate (4–6)", shortLabel: "Moderate", color: "#ffcf00", textColor: "#1f2937", pm25Max: 53 },
    { label: "High (7–9)", shortLabel: "High", color: "#ff0000", textColor: "#ffffff", pm25Max: 70 },
    { label: "Very High (10)", shortLabel: "Very High", color: "#ce30ff", textColor: "#ffffff", pm25Max: Infinity },
  ],
};

// --- WHO 2021 air quality guidelines ----------------------------------------
// Not an index: the value stays the measured concentration and the category
// says which guideline / interim target it meets (24-hour PM2.5 figures).
const WHO_2021: AqiStandard = {
  id: "who_2021",
  name: "WHO 2021 guidelines",
  shortName: "WHO",
  source: "World Health Organization · 24-hour PM2.5",
  attribution:
    "Air quality guideline level (15 µg/m³) and interim targets 1–4 from the World Health Organization Global Air Quality Guidelines, 2021.",
  methodology:
    "The station's latest PM2.5 reading compared against the WHO 24-hour guideline and interim targets. WHO defines these against a 24-hour mean, so this indicates the level a sustained reading would fall in.",
  valueLabel: "µg/m³",
  formatValue: oneDecimal,
  fromPm25: (pm25) => Math.max(0, pm25),
  categories: [
    { label: "Meets WHO guideline (≤15)", shortLabel: "Meets AQG", color: "#22c55e", textColor: "#ffffff", pm25Max: 15 },
    { label: "Interim target 4 (≤25)", shortLabel: "IT-4", color: "#a3e635", textColor: "#1f2937", pm25Max: 25 },
    { label: "Interim target 3 (≤37.5)", shortLabel: "IT-3", color: "#eab308", textColor: "#1f2937", pm25Max: 37.5 },
    { label: "Interim target 2 (≤50)", shortLabel: "IT-2", color: "#f97316", textColor: "#ffffff", pm25Max: 50 },
    { label: "Interim target 1 (≤75)", shortLabel: "IT-1", color: "#dc2626", textColor: "#ffffff", pm25Max: 75 },
    { label: "Above interim target 1", shortLabel: "Above IT-1", color: "#7f1d1d", textColor: "#ffffff", pm25Max: Infinity },
  ],
};

// --- Raw PM2.5 concentration -------------------------------------------------
// The scale this dashboard shipped with. Kept so the raw measurement stays one
// click away for researchers, and so nothing silently changes meaning for
// anyone who was reading the old numbers.
const RAW_PM25: AqiStandard = {
  id: "raw_pm25",
  name: "Raw PM2.5 concentration",
  shortName: "PM2.5",
  source: "Measured value · no index applied",
  attribution:
    "No published index applied. The colour bands are this dashboard's own convention and are not endorsed by any standards body.",
  methodology:
    "The PM2.5 concentration in µg/m³ exactly as the sensor reported it, with no averaging, correction or index conversion.",
  valueLabel: "µg/m³",
  formatValue: oneDecimal,
  fromPm25: (pm25) => Math.max(0, pm25),
  categories: [
    { label: "Good", shortLabel: "Good", color: "#22c55e", textColor: "#ffffff", pm25Max: 15 },
    { label: "Moderate", shortLabel: "Moderate", color: "#eab308", textColor: "#1f2937", pm25Max: 35 },
    {
      label: "Unhealthy (Sensitive)",
      shortLabel: "Unhealthy (SG)",
      color: "#f97316",
      textColor: "#ffffff",
      pm25Max: 55,
    },
    { label: "Unhealthy", shortLabel: "Unhealthy", color: "#dc2626", textColor: "#ffffff", pm25Max: Infinity },
  ],
};

export const AQI_STANDARDS: AqiStandard[] = [US_EPA, EU_EAQI, UK_DAQI, WHO_2021, RAW_PM25];

export const DEFAULT_AQI_STANDARD_ID: AqiStandardId = "us_epa";

const STANDARDS_BY_ID = new globalThis.Map<AqiStandardId, AqiStandard>(
  AQI_STANDARDS.map((s) => [s.id, s])
);

/** Resolve a stored preference to a standard, falling back to the default. */
export function getAqiStandard(id: AqiStandardId | null | undefined): AqiStandard {
  return (id && STANDARDS_BY_ID.get(id)) || STANDARDS_BY_ID.get(DEFAULT_AQI_STANDARD_ID)!;
}

/** Color shown when a station reported no PM2.5 at all. */
export const NO_DATA_COLOR = "#6b7280";

export interface AqiReading {
  /** Index value on the selected scale, or null when PM2.5 was not measured. */
  value: number | null;
  /** Pre-formatted value for display ("—" when unmeasured). */
  display: string;
  category: AqiCategory | null;
  /** Category label, or "No data". */
  label: string;
  color: string;
  textColor: string;
}

const NO_DATA_READING: AqiReading = {
  value: null,
  display: "—",
  category: null,
  label: "No data",
  color: NO_DATA_COLOR,
  textColor: "#ffffff",
};

/**
 * Classify a PM2.5 concentration on the given standard. A missing measurement
 * stays missing — it is never treated as a clean 0 µg/m³.
 */
export function evaluateAqi(
  standard: AqiStandard,
  pm25: number | null | undefined
): AqiReading {
  if (pm25 === null || pm25 === undefined || !Number.isFinite(pm25)) {
    return NO_DATA_READING;
  }

  const concentration = Math.max(0, pm25);
  const category =
    standard.categories.find((c) => concentration <= c.pm25Max) ??
    standard.categories[standard.categories.length - 1];
  const value = standard.fromPm25(concentration);

  return {
    value,
    display: standard.formatValue(value),
    category,
    label: category.label,
    color: category.color,
    textColor: category.textColor,
  };
}

/** Human-readable PM2.5 range for a category, for the map legend. */
export function categoryRangeLabel(standard: AqiStandard, index: number): string {
  const lower = index === 0 ? 0 : standard.categories[index - 1].pm25Max;
  const upper = standard.categories[index].pm25Max;
  if (!Number.isFinite(upper)) return `${lower}+`;
  return `${lower}–${upper}`;
}
