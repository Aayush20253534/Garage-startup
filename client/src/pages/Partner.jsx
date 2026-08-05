import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiMail,
  FiMapPin,
  FiNavigation,
  FiPhone,
  FiShield,
  FiTool,
  FiTruck,
  FiUsers,
} from "react-icons/fi";

import Seo, { SITE_URL } from "@/components/seo/Seo";
import GaragePwaInstall from "@/components/garage/GaragePwaInstall";

const SUPPORT_PHONE_DISPLAY = "+91 86199 55850";
const SUPPORT_PHONE_HREF = "tel:+918619955850";
const SUPPORT_EMAIL = "rovauto.official@gmail.com";
const HERO_DESKTOP = "/images/Rovauto_home-desktop.webp";
const HERO_MOBILE = "/images/Rovauto_home-mobile.webp";

const PARTNER_SIGNALS = [
  {
    icon: FiNavigation,
    title: "Nearby requests",
    description: "Eligible bookings are matched by city, services and radius.",
  },
  {
    icon: FiTool,
    title: "Garage portal",
    description: "Accept work, track progress and manage handover in one flow.",
  },
  {
    icon: FiCreditCard,
    title: "Clear payouts",
    description:
      "Customer-paid final amounts and garage wallet records stay visible.",
  },
];

const BENEFITS = [
  {
    icon: FiMapPin,
    title: "Location-based matching",
    description:
      "Rovauto uses your saved coordinates and working radius to surface practical nearby jobs.",
  },
  {
    icon: FiTruck,
    title: "Vehicle-aware requests",
    description:
      "Supported services and vehicle compatibility help keep irrelevant requests out of your queue.",
  },
  {
    icon: FiShield,
    title: "Verified service flow",
    description:
      "OTP handover, booking status updates and image records make every job easier to trust.",
  },
  {
    icon: FiBarChart2,
    title: "Operational clarity",
    description:
      "Bookings, wallet activity, services and profile details are organized for daily use.",
  },
];

const STEPS = [
  {
    title: "Apply with garage details",
    description:
      "Share owner contact, address, service coverage, coordinates and working radius.",
  },
  {
    title: "Complete verification",
    description:
      "The Rovauto team reviews the application and confirms the garage profile.",
  },
  {
    title: "Start accepting bookings",
    description:
      "Approved garages can receive eligible nearby service requests in the portal.",
  },
];

const REQUIREMENTS = [
  "Accurate garage address and map location",
  "Owner phone number and email access",
  "Services you can reliably provide",
  "Working radius for pickup and arrival",
  "Clear customer communication",
  "Vehicle handover through the portal",
];

const PARTNER_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Rovauto Garage Partner Program",
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
        title="Rovauto Garage Partner Program"
        description="Join Rovauto as a verified garage partner and receive nearby vehicle-service bookings based on your supported services, location and working radius."
        path="/partner"
        structuredData={PARTNER_STRUCTURED_DATA}
      />

      <main className="bg-white">
        <section className="relative isolate flex min-h-[520px] overflow-hidden sm:min-h-[560px] lg:min-h-[590px]">
          <picture className="absolute inset-0 -z-20 block h-full w-full">
            <source
              media="(max-width: 640px)"
              srcSet={HERO_MOBILE}
              type="image/webp"
            />
            <source srcSet={HERO_DESKTOP} type="image/webp" />
            <img
              src={HERO_DESKTOP}
              alt="Rovauto vehicle service workshop"
              width="1280"
              height="640"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          </picture>
          <div className="absolute inset-0 -z-10 bg-black/70" />

          <div className="container-x flex flex-1 items-center py-14 sm:py-16">
            <div className="max-w-3xl text-white">
              <span className="inline-flex h-8 items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 text-xs font-bold uppercase text-white">
                <FiUsers aria-hidden="true" />
                Partner With Rovauto
              </span>

              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-6xl">
                Rovauto Garage Partner Program
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
                Grow your garage with nearby service opportunities, structured
                booking workflows and a cleaner way to manage customer handover.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/garage/onboarding"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-black/20 transition hover:bg-brand-dark sm:w-fit"
                >
                  Apply as Partner
                  <FiArrowRight aria-hidden="true" />
                </Link>

                <Link
                  to="/garage/login"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white px-4 text-sm font-bold text-ink shadow-sm shadow-black/20 transition hover:bg-white/90 sm:w-fit"
                >
                  Garage Login
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-line bg-bg-soft">
          <div className="container-x py-6">
            <div className="mb-4">
              <GaragePwaInstall compact />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
            {PARTNER_SIGNALS.map(({ icon: Icon, title, description }) => (
              <article
                key={title}
                className="grid gap-3 rounded-lg border border-line bg-white p-4 shadow-sm"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-brand-soft text-ink">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-ink">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {description}
                  </p>
                </div>
              </article>
            ))}
            </div>
          </div>
        </section>

        <section className="container-x py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <span className="inline-flex h-8 items-center rounded-md bg-brand-soft px-3 text-xs font-bold uppercase text-ink">
                Built For Working Garages
              </span>

              <h2 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-4xl">
                A practical partner flow for real service work.
              </h2>

              <p className="mt-4 leading-7 text-muted">
                Rovauto helps garage owners receive better-matched requests and
                run each booking through a predictable process from acceptance
                to final customer confirmation.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-lg border border-line bg-white p-5 shadow-sm"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-ink text-brand">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-ink text-white">
          <div className="container-x py-14 sm:py-16">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <span className="inline-flex h-8 items-center gap-2 rounded-md bg-white/10 px-3 text-xs font-bold uppercase text-white">
                  <FiClock aria-hidden="true" />
                  Onboarding
                </span>

                <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                  From application to live bookings.
                </h2>

                <p className="mt-4 leading-7 text-white/70">
                  The process is intentionally direct: submit a complete garage
                  profile, complete verification, then use the portal to manage
                  incoming work.
                </p>
              </div>

              <div className="grid gap-4">
                {STEPS.map(({ title, description }, index) => (
                  <article
                    key={title}
                    className="grid gap-4 rounded-lg border border-white/10 bg-white/5 p-5 sm:grid-cols-[auto_1fr] sm:items-start"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-md bg-brand text-sm font-black text-black">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold">{title}</h3>
                      <p className="mt-1 leading-6 text-white/70">
                        {description}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container-x py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start 2xl:grid-cols-[minmax(0,1fr)_500px]">
            <div>
              <h2 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">
                What you need before applying
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-muted">
                Keep these details ready so the application can be reviewed
                without unnecessary back-and-forth.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {REQUIREMENTS.map((requirement) => (
                  <div
                    key={requirement}
                    className="flex items-start gap-3 rounded-lg border border-line bg-white p-4 shadow-sm"
                  >
                    <FiCheckCircle
                      className="mt-0.5 shrink-0 text-lg text-brand-dark"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold leading-6 text-ink">
                      {requirement}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-lg border border-line bg-bg-soft p-5 shadow-sm">
              <h2 className="text-xl font-bold text-ink">
                Partnership support
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Contact Rovauto for onboarding questions, verification help or
                garage portal assistance.
              </p>

              <div className="mt-5 grid gap-3">
                <a
                  href={SUPPORT_PHONE_HREF}
                  className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-white px-4 py-3 text-sm font-bold text-ink transition hover:border-brand-dark"
                >
                  <FiPhone className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{SUPPORT_PHONE_DISPLAY}</span>
                </a>

                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=Rovauto%20Garage%20Partnership`}
                  className="flex min-w-0 items-center gap-3 rounded-md border border-line bg-white px-4 py-3 text-sm font-bold text-ink transition hover:border-brand-dark"
                >
                  <FiMail className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{SUPPORT_EMAIL}</span>
                </a>

                <Link
                  to="/garage/onboarding"
                  className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-bold text-white transition hover:bg-ink-2"
                >
                  Start Application
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
