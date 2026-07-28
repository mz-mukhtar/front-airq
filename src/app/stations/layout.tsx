import type { Metadata } from "next";

/**
 * Server layout purely so this route can carry metadata — page.tsx is a Client
 * Component and cannot export it.
 *
 * The station explorer is behind auth, so this is a noindex page: it has no
 * content a crawler can reach, and letting one spend budget on a route that
 * redirects to /login puts a thin, useless entry in the index. The public
 * equivalent is the station list on the landing page.
 */
export const metadata: Metadata = {
  title: "Monitoring stations",
  description:
    "Browse every air quality monitoring station in the Addis Air Net network with live readings.",
  robots: { index: false, follow: false },
};

export default function StationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
