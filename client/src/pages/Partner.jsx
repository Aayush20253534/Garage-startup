import { Link } from "react-router-dom";
import { FiCheckCircle, FiArrowRight } from "react-icons/fi";
import Seo, { SITE_URL } from "@/components/seo/Seo";

const SUPPORT_PHONE_DISPLAY = "+91 98993 19913";

export default function Partner() {
  return (
    <>
      <Seo
        title="Partner Your Garage With Rovauto"
        description="Join Rovauto as a verified garage partner and receive nearby vehicle service bookings based on your location and working radius."
        path="/partner"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Rovauto Garage Partner Network",
          url: `${SITE_URL}/partner`,
          parentOrganization: {
            "@type": "Organization",
            name: "Rovauto",
            url: SITE_URL,
          },
        }}
      />

      <div className="container-x py-8">
      <div className="max-w-3xl">
        <span className="chip-brand">Partner With Us</span>

        <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
          Grow your garage with verified leads.
        </h1>

        <p className="mt-4 text-lg text-muted">
          Join 8,000+ garages already growing with Rovauto. Get bookings via
          WhatsApp, manage jobs from a simple portal, and get paid faster.
        </p>

        <h2 className="mt-8 text-2xl font-bold text-ink">
          Why garages partner with Rovauto
        </h2>

        <ul className="mt-4 grid gap-3 text-sm">
          {[
            "Verified, paid leads via WhatsApp magic links",
            "Zero app required to start",
            "Transparent wallet & instant payouts",
            "Reputation-based ranking, quality bonuses",
            "Insurance & spare-parts assistance",
          ].map((x) => (
            <li key={x} className="flex items-center gap-3">
              <FiCheckCircle className="shrink-0 text-lg text-brand-dark" />
              <span>{x}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to="/garage/login"
            className="btn-dark inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            Login to Garage Portal
            <FiArrowRight className="h-4 w-4" />
          </Link>

          <Link
            to="/garage/onboarding"
            className="btn-ghost inline-flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            Full onboarding form
            <FiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}
