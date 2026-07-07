import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiCheckCircle,
  FiMail,
  FiPhone,
} from "react-icons/fi";

import Seo, { SITE_URL } from "@/components/seo/Seo";

const SUPPORT_PHONE_DISPLAY = "+91 86199 55850";
const SUPPORT_PHONE_HREF = "tel:+918619955850";
const SUPPORT_EMAIL = "rovauto.official@gmail.com";

const BENEFITS = [
  "Receive nearby booking requests for services your garage supports",
  "Accept eligible requests from the garage portal or secure booking link",
  "Manage booking progress, pickup verification and delivery updates",
  "Build a public reputation through completed jobs and customer reviews",
  "Control your supported services, location and working radius",
];

const PARTNER_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Partner Your Garage With Rovauto",
  url: `${SITE_URL}/partner`,
  description:
    "Garage owners can apply to join Rovauto and receive nearby vehicle-service booking requests.",
  about: {
    "@type": "Organization",
    name: "Rovauto",
    url: SITE_URL,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "garage partnerships",
      telephone: "+918619955850",
      email: SUPPORT_EMAIL,
      areaServed: "IN",
      availableLanguage: ["English", "Hindi"],
    },
  },
};

export default function Partner() {
  return (
    <>
      <Seo
        title="Partner Your Garage With Rovauto"
        description="Join Rovauto as a verified garage partner and receive nearby vehicle-service bookings based on your supported services, location and working radius."
        path="/partner"
        structuredData={PARTNER_STRUCTURED_DATA}
      />

      <main className="container-x py-12 sm:py-16">
        <section className="max-w-4xl">
          <span className="chip-brand">Partner With Rovauto</span>

          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">
            Grow your garage with nearby service opportunities.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">
            Apply to join Rovauto&apos;s garage partner network. Approved
            garages can receive nearby booking requests based on supported
            services, vehicle compatibility, saved coordinates and working
            radius.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/garage/onboarding"
              className="btn-dark inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            >
              Apply as a Garage Partner
              <FiArrowRight />
            </Link>

            <Link
              to="/garage/login"
              className="btn-ghost inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            >
              Garage Login
              <FiArrowRight />
            </Link>
          </div>
        </section>

        <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <h2 className="text-3xl font-bold text-ink">
              Why garages partner with Rovauto
            </h2>

            <ul className="mt-6 grid gap-4">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4"
                >
                  <FiCheckCircle
                    className="mt-0.5 shrink-0 text-xl text-brand-dark"
                    aria-hidden="true"
                  />
                  <span className="leading-7 text-ink">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside className="rounded-3xl bg-bg-soft p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-ink">
              Garage partnership support
            </h2>

            <p className="mt-3 leading-7 text-muted">
              Contact the Rovauto team for onboarding, verification or garage
              portal assistance.
            </p>

            <div className="mt-6 grid gap-3">
              <a
                href={SUPPORT_PHONE_HREF}
                className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 font-semibold text-ink transition hover:border-brand"
              >
                <FiPhone aria-hidden="true" />
                {SUPPORT_PHONE_DISPLAY}
              </a>

              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=Rovauto%20Garage%20Partnership`}
                className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 font-semibold text-ink transition hover:border-brand"
              >
                <FiMail aria-hidden="true" />
                {SUPPORT_EMAIL}
              </a>
            </div>
          </aside>
        </section>

        <section className="mt-16 rounded-3xl bg-ink p-7 text-white sm:p-10">
          <h2 className="text-3xl font-bold">
            How garage onboarding works
          </h2>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              [
                "1",
                "Submit garage details",
                "Provide business, service, location and contact information.",
              ],
              [
                "2",
                "Complete verification",
                "Rovauto reviews the application and submitted garage details.",
              ],
              [
                "3",
                "Receive booking requests",
                "Approved garages can receive eligible nearby service requests.",
              ],
            ].map(([number, title, description]) => (
              <article
                key={number}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-brand font-bold text-black">
                  {number}
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 leading-7 text-white/70">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
