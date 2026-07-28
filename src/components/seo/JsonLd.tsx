/**
 * Structured data, rendered as a native <script type="application/ld+json">.
 *
 * A plain script tag rather than next/script: JSON-LD is data, not executable
 * code, and Next explicitly recommends the native tag so it lands in the
 * initial HTML where crawlers read it. It is a CSP *data block*, so the app's
 * `script-src 'self' 'unsafe-inline'` does not gate it either way.
 *
 * Server Component — must stay out of any "use client" tree so the markup is
 * present in the prerendered HTML rather than injected after hydration.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // JSON.stringify does not escape HTML. A "</script>" appearing inside
        // any string value — a station name, say — would close the tag early
        // and turn the rest of the payload into live markup. Escaping "<"
        // closes that off; it is the mitigation Next's own guide prescribes.
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
