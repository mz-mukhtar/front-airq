import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd } from "@/lib/structured-data";
import { OG_BASE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Getting started",
  description:
    "How to read the Addis Air Net air quality map, what PM2.5 and PM1.0 mean, and how to choose between the US EPA, European EAQI, UK DAQI and WHO 2021 air quality standards.",
  alternates: { canonical: "/getting-started" },
  openGraph: {
    ...OG_BASE,
    title: "Getting started with Addis Air Net",
    description:
      "How to read the air quality map and what the measurements mean.",
    url: "/getting-started",
  },
};

export default function GettingStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={breadcrumbLd("Getting started", "/getting-started")} />
      {children}
    </>
  );
}
