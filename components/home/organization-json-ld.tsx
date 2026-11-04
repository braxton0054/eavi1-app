import { campuses, site } from "@/lib/content/home";

/** schema.org EducationalOrganization with one sub-organization per campus. */
export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: site.name,
    alternateName: site.shortName,
    slogan: site.tagline,
    description: site.description,
    url: site.url,
    logo: `${site.url}/logo.png`,
    telephone: campuses[0]?.phone,
    email: site.email ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Eldoret",
      addressCountry: "KE",
    },
    department: campuses.map((campus) => ({
      "@type": "EducationalOrganization",
      name: `${site.shortName} ${campus.name}`,
      telephone: campus.phone,
      address: {
        "@type": "PostalAddress",
        streetAddress: campus.place,
        addressLocality: "Eldoret",
        addressCountry: "KE",
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
