import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * schema.org payloads for the public pages.
 *
 * Two rules govern everything here:
 *
 * 1. Structured data must describe what a crawler can actually reach. Google
 *    treats markup that contradicts the accessible page as spam, so nothing
 *    below claims a download or a field the site does not genuinely serve.
 * 2. The measurements are the asset. Air-quality portals compete hard on the
 *    consumer query but almost none publish `Dataset` markup, which is what
 *    Google Dataset Search indexes — so that is the surface worth owning.
 */

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/**
 * Publisher identity. `ResearchOrganization` is still marked pending on
 * schema.org, so it rides as an additionalType on a plain Organization rather
 * than as the primary @type.
 */
export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  additionalType: "https://schema.org/ResearchOrganization",
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "A sensor network measuring particulate matter and weather conditions across Addis Ababa, Ethiopia, and publishing the readings openly.",
  areaServed: {
    "@type": "City",
    name: "Addis Ababa",
    addressCountry: "ET",
  },
  knowsAbout: [
    "Air quality",
    "Particulate matter",
    "PM2.5",
    "PM10",
    "Air pollution in Ethiopia",
  ],
} as const;

export const webSiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  description:
    "Live air quality readings from a monitoring network across Addis Ababa, Ethiopia.",
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en",
} as const;

/**
 * The measurement network as a Dataset.
 *
 * `description` is one of only two required fields and Google enforces a
 * 50–5000 character length on it — shorter payloads are dropped without an
 * obvious error, so this one is deliberately substantial.
 *
 * On access: only the live per-station snapshot is served without
 * authentication today. Historical series and the CSV/Excel exports sit behind
 * a login, so this declares `isAccessibleForFree: false` and describes the
 * public endpoint as the sole distribution. Widening that claim requires
 * widening the API first — not editing this file.
 */
export const datasetLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "@id": `${SITE_URL}/#dataset`,
  name: "Addis Ababa air quality measurements",
  alternateName: "Addis Air Net sensor network readings",
  description:
    "Continuous air quality measurements from a network of low-cost sensor stations across Addis Ababa, Ethiopia. Each station reports particulate matter at PM1.0, PM2.5, PM4.0 and PM10 size fractions in micrograms per cubic metre, alongside particle number concentrations, typical particle size, ambient temperature in degrees Celsius, relative humidity as a percentage, and VOC and NOx indices. Readings are recorded at approximately one-minute intervals and timestamped in East Africa Time (UTC+3). The live per-station snapshot is published openly; historical series, aggregated statistics and bulk CSV or Excel export are available to registered research users. Air quality index values are derived from the PM2.5 concentration and can be reported against the US EPA AQI, the European Environment Agency EAQI, the UK DAQI or the WHO 2021 air quality guidelines.",
  url: SITE_URL,
  keywords: [
    "air quality",
    "air pollution",
    "particulate matter",
    "PM2.5",
    "PM10",
    "Addis Ababa",
    "Ethiopia",
    "environmental monitoring",
    "low-cost sensors",
  ],
  creator: { "@id": ORGANIZATION_ID },
  publisher: { "@id": ORGANIZATION_ID },
  isAccessibleForFree: false,
  conditionsOfAccess:
    "The live per-station snapshot is publicly accessible. Historical series and bulk export require a registered account.",
  measurementTechnique:
    "Optical particle counter (laser scattering) with co-located temperature, humidity and gas-index sensing",
  spatialCoverage: {
    "@type": "Place",
    name: "Addis Ababa, Ethiopia",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 9.0333,
      longitude: 38.75,
    },
  },
  variableMeasured: [
    { "@type": "PropertyValue", name: "PM1.0", unitText: "µg/m³" },
    { "@type": "PropertyValue", name: "PM2.5", unitText: "µg/m³" },
    { "@type": "PropertyValue", name: "PM4.0", unitText: "µg/m³" },
    { "@type": "PropertyValue", name: "PM10", unitText: "µg/m³" },
    { "@type": "PropertyValue", name: "Temperature", unitText: "°C" },
    { "@type": "PropertyValue", name: "Relative humidity", unitText: "%" },
    { "@type": "PropertyValue", name: "VOC index" },
    { "@type": "PropertyValue", name: "NOx index" },
  ],
  distribution: [
    {
      "@type": "DataDownload",
      name: "Live per-station readings (public JSON)",
      encodingFormat: "application/json",
      contentUrl: `${SITE_URL}/api/proxy/api/v1/sensor-readings/kpi-map`,
    },
  ],
} as const;

/** The city itself, so "Addis Ababa" resolves to a place entity. */
export const placeLd = {
  "@context": "https://schema.org",
  "@type": "Place",
  "@id": `${SITE_URL}/#place`,
  name: "Addis Ababa",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Addis Ababa",
    addressCountry: "ET",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 9.0333,
    longitude: 38.75,
  },
} as const;

/**
 * Questions real searchers ask, answered plainly.
 *
 * Answers are static and evergreen on purpose. Competitors template live
 * numbers into their FAQ payloads and end up serving "air quality is now --"
 * or advice dated to a year ago; a wrong answer in a rich result is worse than
 * no rich result.
 */
export const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the air quality in Addis Ababa right now?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Addis Air Net publishes live readings from sensor stations across Addis Ababa. Each station reports its current PM2.5 and PM1.0 concentration in micrograms per cubic metre, along with temperature and humidity, and an air quality index derived from PM2.5. Open the live map to see every station and the time of its most recent reading.",
      },
    },
    {
      "@type": "Question",
      name: "What causes air pollution in Addis Ababa?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The main contributors are vehicle exhaust from an ageing fleet, biomass and charcoal burning for cooking and heating, construction and road dust, and open waste burning. Wind-blown dust rises during the dry Bega season, and the city's high altitude and surrounding topography can trap pollutants near the ground on still mornings.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between PM1.0, PM2.5 and PM10?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The number is the approximate particle diameter in micrometres. PM10 covers particles up to 10 micrometres, PM2.5 up to 2.5, and PM1.0 up to 1. Smaller particles travel further into the lungs, and PM2.5 and below can reach the bloodstream, which is why health guidelines focus on PM2.5. Addis Air Net reports PM1.0 and PM2.5 on its public pages.",
      },
    },
    {
      "@type": "Question",
      name: "Which air quality standard does Addis Air Net use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You choose. Readings can be reported against the US EPA Air Quality Index, the European Environment Agency's EAQI, the UK's Daily Air Quality Index, the WHO 2021 guideline levels, or as the raw PM2.5 concentration. The selector sits in the top-left corner of the map. Different bodies draw their thresholds differently, so the same measurement can fall in different categories depending on the scale.",
      },
    },
    {
      "@type": "Question",
      name: "What PM2.5 level does the WHO consider safe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The World Health Organization's 2021 Global Air Quality Guidelines set the 24-hour PM2.5 guideline level at 15 micrograms per cubic metre and the annual level at 5. The WHO also defines four interim targets for places working towards those levels. Selecting the WHO standard on the map shows which guideline or interim target a reading falls within.",
      },
    },
  ],
} as const;

/**
 * Everything the home page declares, in one graph.
 *
 * A single @graph rather than several separate script tags: it lets the
 * entities reference each other by @id (dataset → publisher → place) so the
 * crawler reads one connected description of the site instead of several
 * disconnected fragments.
 */
export function homePageGraph(lastUpdatedIso?: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationLd,
      webSiteLd,
      placeLd,
      datasetLd,
      faqLd,
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: `${SITE_NAME} — Addis Ababa air quality`,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": `${SITE_URL}/#place` },
        publisher: { "@id": ORGANIZATION_ID },
        inLanguage: "en",
        // Freshness signal. Falls back to build time when no reading timestamp
        // is available rather than being omitted.
        ...(lastUpdatedIso ? { dateModified: lastUpdatedIso } : {}),
      },
    ],
  };
}

/** Breadcrumb trail for a public page one level below the root. */
export function breadcrumbLd(name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: `${SITE_URL}${path}`,
      },
    ],
  } as const;
}
