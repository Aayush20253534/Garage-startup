import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiHeart,
  FiTarget,
  FiZap,
} from "react-icons/fi";

import { LOGO_URL } from "@/data/vehicles";
import Seo, { SITE_URL } from "@/components/seo/Seo";

const SOCIAL_PROFILES = [
  "https://instagram.com/rovauto.official",
  "https://x.com/Rovauto_ON",
  "https://www.youtube.com/@Rovauto",
  "https://www.facebook.com/share/18AVZ22uvY/",
];

const ABOUT_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Rovauto",
  url: `${SITE_URL}/about`,
  description:
    "Rovauto connects vehicle owners with verified garages through a transparent vehicle-service platform.",
  mainEntity: {
    "@type": "Organization",
    name: "Rovauto",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    email: "mailto:rovauto.official@gmail.com",
    telephone: "+918619955850",
    areaServed: {
      "@type": "City",
      name: "Prayagraj",
    },
    sameAs: SOCIAL_PROFILES,
  },
};

const VALUES = [
  {
    icon: FiTarget,
    title: "Our Mission",
    description:
      "Make vehicle servicing easier to understand, easier to book and more trustworthy for customers.",
  },
  {
    icon: FiHeart,
    title: "Our Values",
    description:
      "Honesty, transparent communication and responsible service for customers and garage partners.",
  },
  {
    icon: FiZap,
    title: "Our Approach",
    description:
      "Location-based garage matching, clear service workflows, digital updates and verified handover steps.",
  },
];

export default function About() {
  return (
    <>
      <Seo
        title="About Rovauto"
        description="Learn how Rovauto connects vehicle owners with verified garages through transparent pricing, location-based matching and digital service tracking."
        path="/about"
        structuredData={ABOUT_STRUCTURED_DATA}
      />

      <main className="container-x py-10">
        <section className="grid items-center gap-12 lg:grid-cols-2">
          <div>

            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">
              Building a more trusted vehicle-service experience.
            </h1>

            <p className="mt-5 text-lg leading-8 text-muted">
              Rovauto helps vehicle owners discover and book verified garages
              through a structured service flow. Customers can select services,
              share a pickup location, receive garage details, track progress
              and confirm vehicle delivery from one platform.
            </p>

            <p className="mt-4 leading-7 text-muted">
              Garage partners receive nearby service requests based on their
              supported services, saved location and configured working radius.
              This gives customers a clearer booking experience while helping
              garages manage genuine service opportunities.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/how-it-works"
                className="btn-dark inline-flex items-center justify-center gap-2"
              >
                See How Rovauto Works
                <FiArrowRight />
              </Link>

              <Link
                to="/partner"
                className="btn-ghost inline-flex items-center justify-center gap-2"
              >
                Partner With Rovauto
                <FiArrowRight />
              </Link>
            </div>
          </div>

          <div className="grid aspect-square place-items-center rounded-3xl bg-bg-soft">
            <img
              src={LOGO_URL}
              alt="Rovauto vehicle service platform logo"
              width="500"
              height="500"
              decoding="async"
              className="w-2/3"
            />
          </div>
        </section>

        <section className="mt-20" aria-labelledby="values-heading">
          <div className="max-w-2xl">
            <h2
              id="values-heading"
              className="text-3xl font-bold text-ink sm:text-4xl"
            >
              What Rovauto stands for
            </h2>

            <p className="mt-3 leading-7 text-muted">
              The platform is designed around practical safeguards, transparent
              service information and a more reliable connection between
              vehicle owners and garage partners.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3 2xl:gap-7">
            {VALUES.map(({ icon: Icon, title, description }) => (
              <article key={title} className="card-soft p-6">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-brand">
                  <Icon aria-hidden="true" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-ink">
                  {title}
                </h3>

                <p className="mt-2 leading-7 text-muted">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 rounded-3xl bg-ink p-7 text-white sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-3xl font-bold">
                Learn more about the platform
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-white/70">
                Explore available vehicle services, understand the booking
                process or contact the Rovauto team for support and partnership
                enquiries.
              </p>
            </div>

            <nav
              aria-label="About Rovauto links"
              className="flex flex-wrap gap-3"
            >
              <Link
                to="/services"
                className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-black"
              >
                Browse Services
              </Link>

              <Link
                to="/contact"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white"
              >
                Contact Rovauto
              </Link>
            </nav>
          </div>
        </section>
      </main>
    </>
  );
}
