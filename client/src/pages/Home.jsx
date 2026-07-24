import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiNavigation,
  FiShield,
  FiStar,
  FiTool,
} from "react-icons/fi";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import SafeImage from "@/components/common/SafeImage";
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import Seo, { SITE_ICON, SITE_URL } from "@/components/seo/Seo";
import { getServiceCategoryPath } from "@/utils/serviceSlug";
import ServicePriceDisplay from "@/components/services/ServicePriceDisplay";
import {
  getCategoryThumbnailUrl,
  getServiceThumbnailUrl,
} from "@/utils/imageCache";

const TRUST = [
  { icon: FiCheckCircle, label: "Verified Garages" },
  { icon: FiShield, label: "Service Warranty" },
  { icon: FiTool, label: "Transparent Pricing" },
  { icon: FiNavigation, label: "Live Tracking" },
  { icon: FiClock, label: "Fast Booking" },
];

const HOMEPAGE_HERO_DESKTOP = "/images/Rovauto_home-desktop.webp";
const HOMEPAGE_HERO_MOBILE = "/images/Rovauto_home-mobile.webp";

const HOME_STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Rovauto",
    url: SITE_URL,
    logo: SITE_ICON,
    description:
      "Rovauto connects vehicle owners with verified garages for repair, maintenance, pickup, tracking and service warranty.",
    email: "rovauto.official@gmail.com",
    telephone: "+918619955850",
    areaServed: {
      "@type": "City",
      name: "Prayagraj",
    },
    sameAs: [
      "https://instagram.com/rovauto.official",
      "https://x.com/Rovauto_ON",
      "https://www.youtube.com/@Rovauto",
      "https://www.facebook.com/share/18AVZ22uvY/",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Rovauto",
    url: SITE_URL,
  },
];

const toBoolean = (value) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const formatCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return new Intl.NumberFormat("en-IN").format(
    Math.max(0, Math.trunc(number)),
  );
};

const formatAverageRating = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0";

  return `${Math.min(5, number).toFixed(1)}★`;
};

const getHomepagePopularServices = (serviceCategories = []) => {
  const allServices = serviceCategories.flatMap((category) =>
    (category.services || []).map((service) => ({
      ...service,
      category,
    })),
  );

  const configuredServices = allServices
    .filter((service) => toBoolean(service.isPopular))
    .sort((left, right) => {
      const leftOrder = Number(left.popularOrder) || Number.MAX_SAFE_INTEGER;
      const rightOrder = Number(right.popularOrder) || Number.MAX_SAFE_INTEGER;

      return leftOrder - rightOrder || left.name.localeCompare(right.name);
    });

  return configuredServices.slice(0, 6);
};

export default function Home() {
  const { user, vehicle, location, fetchServiceCategories } = useApp();

  const [categories, setCategories] = useState([]);
  const [popularServices, setPopularServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partnerStats, setPartnerStats] = useState({
    garages: null,
    customers: null,
    averageRating: null,
  });
  useEffect(() => {
    let mounted = true;

    api
      .get("/public/stats", {
        skipSessionExpiryMessage: true,
      })
      .then((response) => {
        if (!mounted) return;

        const stats = response.data?.data || response.data || {};

        setPartnerStats({
          garages: formatCount(stats.garages),
          customers: formatCount(stats.customers),
          averageRating: formatAverageRating(stats.averageRating),
        });
      })
      .catch(() => {
        if (!mounted) return;
        setPartnerStats({
          garages: null,
          customers: null,
          averageRating: null,
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.resolve(fetchServiceCategories())
      .then((serviceCategories) => {
        if (!mounted) return;

        const normalizedCategories = Array.isArray(serviceCategories)
          ? serviceCategories
          : [];

        const services = getHomepagePopularServices(normalizedCategories);

        setCategories(normalizedCategories);
        setPopularServices(services);
      })
      .catch(() => {
        if (!mounted) return;
        setCategories([]);
        setPopularServices([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id, vehicle?.id, location?.city]);

  return (
    <>
      <Seo
        title="Verified Vehicle Service and Garage Booking in Prayagraj"
        description="Book verified garages in Prayagraj for vehicle repair, maintenance, pickup, live tracking and a 30-day service warranty with Rovauto."
        path="/"
        structuredData={HOME_STRUCTURED_DATA}
      />

      <main className="overflow-x-hidden">
        <section className="relative flex min-h-[72vh] items-start overflow-hidden lg:min-h-[calc(100vh-96px)]">
          <div className="absolute inset-0 -z-10">
            <picture className="block h-full w-full">
              <source
                media="(max-width: 640px)"
                srcSet={HOMEPAGE_HERO_MOBILE}
                type="image/webp"
              />
              <source srcSet={HOMEPAGE_HERO_DESKTOP} type="image/webp" />
              <img
                alt="Rovauto verified vehicle service workshop"
                src={HOMEPAGE_HERO_DESKTOP}
                width="1280"
                height="640"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
            </picture>

            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </div>

          <div className="container-x relative z-10 py-10 sm:py-14 lg:py-12">
            <div
              className="rov-fade-up max-w-3xl text-white"
            >
              <div className="flex flex-col items-start gap-2 lg:flex-row lg:items-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  New in Prayagraj
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  <FiClock className="shrink-0" />
                  Daily services · 10 AM–10 PM
                </span>
              </div>

              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-7xl">
                Verified Vehicle Service and Garage Booking in Prayagraj
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-lg">
                Book car and bike repair, maintenance, pickup and doorstep
                service from verified garages with transparent pricing, live
                tracking and a 30-day service warranty.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                <Link
                  to="/booking/vehicle"
                  className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-2.5 text-xs font-bold text-black shadow-2xl transition hover:bg-brand-dark sm:w-auto sm:gap-2 sm:px-5 sm:text-sm"
                >
                  Book Service <FiArrowRight />
                </Link>

                <Link
                  to="/partner"
                  className="inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-2.5 text-center text-xs font-bold text-white transition hover:border-white hover:bg-white/15 sm:w-auto sm:px-5 sm:text-sm"
                >
                  Become a Partner
                </Link>

              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3">
                {TRUST.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 text-sm text-white/85"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
                        <Icon />
                      </span>
                      {item.label}
                    </div>
                  );
                })}
              </div>

              <div className="mt-7 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {["A", "R", "S", "P"].map((letter, index) => (
                    <span
                      key={index}
                      className="grid h-9 w-9 place-items-center rounded-full border-2 border-black/10 bg-white text-xs font-bold text-ink"
                    >
                      {letter}
                    </span>
                  ))}
                </div>

                <div className="text-sm">

                  <div className="text-xs text-white/70">
                    Built for vehicle owners and garage partners
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-x py-14">
          <div className="mb-7 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-3xl font-bold text-ink sm:text-4xl">
                Vehicle Repair and Maintenance Services
              </h2>

              <p className="mt-2 text-sm text-muted sm:text-base">
                Explore trusted car and bike services from verified garages in
                Prayagraj.
              </p>
            </div>

            <Link
              to="/services"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft sm:w-auto"
            >
              View all <FiArrowRight />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[4/5] animate-pulse rounded-2xl bg-bg-soft sm:aspect-[4/3] lg:aspect-[5/4]"
                />
              ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
              {categories.slice(0, 8).map((category) => {
                const ui = CATEGORY_UI[category.name] || {};
                const image = getCategoryThumbnailUrl(category);
                const isSos = ui.isSos;
                const categoryServices = category.services || [];
                const serviceCount = categoryServices.length;
                const categoryComingSoon =
                  toBoolean(category.isComingSoon) ||
                  (serviceCount > 0 &&
                    categoryServices.every((service) =>
                      toBoolean(service.isComingSoon)
                    ));

                return (
                  <div
                    key={category.id}
                  >
                    <Link
                      to={
                        categoryComingSoon
                          ? "#"
                          : isSos
                            ? "/sos"
                            : getServiceCategoryPath(category)
                      }
                      onClick={(event) => {
                        if (categoryComingSoon) {
                          event.preventDefault();
                        }
                      }}
                      aria-disabled={categoryComingSoon}
                      className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-ink shadow-sm transition duration-300 sm:aspect-[4/3] lg:aspect-[5/4] lg:rounded-3xl ${
                        categoryComingSoon
                          ? "cursor-not-allowed"
                          : "hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
                      }`}
                    >
                      <SafeImage
                        src={image}
                        alt={category.name}
                        width="640"
                        height="512"
                        loading="lazy"
                        decoding="async"
                        className={`absolute inset-0 h-full w-full object-cover transition duration-500 ease-out ${
                          categoryComingSoon
                            ? "scale-105 blur-sm grayscale"
                            : "group-hover:scale-[1.07]"
                        }`}
                        fallback={
                          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-800 to-slate-950 text-4xl text-white/70">
                            <FiTool />
                          </div>
                        }
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5 transition duration-300 group-hover:from-black/95 group-hover:via-black/30" />

                      {categoryComingSoon ? (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6">
                          <p className="max-w-[260px] text-center text-xl font-bold leading-relaxed text-white sm:text-2xl">
                            {isSos
                              ? "Roadside assistance Coming soon"
                              : "This category is Coming soon"}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3 lg:p-4">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur-md lg:text-[11px] ${
                                isSos
                                  ? "border-red-300/40 bg-red-500/90 text-white"
                                  : "border-white/20 bg-black/30 text-white"
                              }`}
                            >
                              {isSos
                                ? "Emergency"
                                : serviceCount > 0
                                  ? `${serviceCount} service${
                                      serviceCount === 1 ? "" : "s"
                                    }`
                                  : "Vehicle care"}
                            </span>
                          </div>

                          <div className="absolute inset-x-0 bottom-0 z-10 p-3.5 sm:p-4 lg:p-5">
                            <div className="flex items-end justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="line-clamp-2 text-base font-bold leading-tight text-white sm:text-lg lg:text-xl">
                                  {category.name}
                                </h3>

                                <p className="mt-1 hidden text-xs font-medium text-white/65 sm:block lg:text-sm">
                                  {isSos
                                    ? "Get immediate roadside help"
                                    : "Explore available services"}
                                </p>
                              </div>

                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-md transition duration-300 group-hover:border-brand group-hover:bg-brand group-hover:text-black lg:h-10 lg:w-10">
                                <FiArrowRight className="transition-transform duration-300 group-hover:translate-x-0.5" />
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-bg-soft p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-xl text-muted shadow-sm">
                <FiTool />
              </div>

              <p className="mt-3 text-sm font-semibold text-ink">
                No service categories are available right now.
              </p>
            </div>
          )}
        </section>

        <section className="bg-bg-soft py-16">
          <div className="container-x">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
                How it works
              </span>

              <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">
                How Rovauto Vehicle Service Booking Works
              </h2>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {[
                ["Add your car", "Tell us your brand, model, and fuel."],
                ["Pick a service", "Choose from transparent service packages."],
                [
                  "Auto-assign garage",
                  "We match you with the best nearby verified garage.",
                ],
                [
                  "Live tracking",
                  "Track status, talk to mechanic, get warranty.",
                ],
              ].map(([title, desc], index) => (
                <div
                  key={title}
                  className="card-soft rounded-2xl p-4 shadow-sm"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-brand">
                    {index + 1}
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container-x py-12 sm:py-16">
          <div className="mb-6 flex flex-col items-start gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-3xl font-bold text-ink sm:text-4xl">
                Popular Vehicle Services
              </h2>
            </div>

            <Link
              to="/services"
              className="inline-flex h-11 w-full max-w-full items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft sm:h-10 sm:w-auto sm:rounded-lg"
            >
              Browse all services <FiArrowRight className="shrink-0" />
            </Link>
          </div>

          {loading ? (
            <div className="card-soft rounded-2xl p-5 text-sm text-muted">
              Loading popular services...
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {popularServices.map((service) => {
                const image = getServiceThumbnailUrl(service);
                const hasPrice = Boolean(user && service.priceRange);
                const comingSoon =
                  toBoolean(service.isComingSoon) ||
                  toBoolean(service.category?.isComingSoon);

                return (
                  <Link
                    to={
                      comingSoon ? "#" : getServiceCategoryPath(service.category)
                    }
                    onClick={(event) => {
                      if (comingSoon) event.preventDefault();
                    }}
                    aria-disabled={comingSoon}
                    key={service.id}
                    className={`card-soft group block w-full min-w-0 overflow-hidden rounded-2xl p-3 shadow-sm transition sm:p-4 ${
                      comingSoon
                        ? "cursor-not-allowed"
                        : "hover:-translate-y-1 hover:shadow-md"
                    }`}
                  >
                    {image && (
                      <div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-xl bg-bg-soft sm:mb-4 sm:h-40 sm:aspect-auto">
                        <SafeImage
                          src={image}
                          alt={`${service.name} vehicle service`}
                          width="640"
                          height="360"
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full object-cover transition-transform ${
                            comingSoon
                              ? "scale-105 blur-sm grayscale"
                              : "group-hover:scale-105"
                          }`}
                          fallback={
                            <div className="grid h-full w-full place-items-center text-3xl text-muted">
                              <FiTool />
                            </div>
                          }
                        />

                        {comingSoon && <ComingSoonOverlay />}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="line-clamp-2 min-w-0 text-xl font-bold leading-snug text-ink sm:truncate sm:text-lg">
                              {service.name}
                            </h3>

                            {comingSoon && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                Coming Soon
                              </span>
                            )}
                          </div>

                          <p className="mt-1 line-clamp-2 text-[15px] leading-6 text-muted sm:text-sm sm:leading-5">
                            {service.description}
                          </p>

                          {user && !hasPrice && !comingSoon && (
                            <p className="mt-2 text-xs font-bold text-amber-700">
                              {service.priceUnavailableMessage ||
                                "Price not allocated for this vehicle"}
                            </p>
                          )}
                        </div>

                        {hasPrice && !comingSoon && (
                          <div className="hidden shrink-0 text-right sm:block">
                            <div className="text-xs text-muted">From</div>
                            <ServicePriceDisplay
                              service={service}
                              mode="min"
                              className="justify-end"
                              regularClassName="text-sm font-bold text-red-500 line-through decoration-2 decoration-red-400/90"
                              currentClassName="text-xl font-black tracking-tight text-ink"
                            />
                          </div>
                        )}
                      </div>

                      {hasPrice && !comingSoon && (
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-bg-soft px-3 py-2 sm:hidden">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                            From
                          </span>

                          <ServicePriceDisplay
                            service={service}
                            mode="min"
                            className="justify-end"
                            regularClassName="text-xs font-bold text-red-500 line-through decoration-2 decoration-red-400/90"
                            currentClassName="text-lg font-black tracking-tight text-ink"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex min-w-0 items-center justify-between gap-3">

                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink/80 group-hover:text-ink">
                        {comingSoon ? (
                          "Coming Soon"
                        ) : (
                          <>
                            Add <FiArrowRight className="inline shrink-0" />
                          </>
                        )}
                      </span>
                    </div>
                  </Link>
                );
              })}

              {popularServices.length === 0 && (
                <div className="card-soft rounded-2xl p-5 text-sm text-muted">
                  No popular services found.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="border-y border-line bg-white py-14">
          <div className="container-x">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-ink sm:text-4xl">
                Explore Rovauto
              </h2>

              <p className="mt-3 text-sm leading-6 text-muted sm:text-base">
                Learn about our booking process, service warranty, garage
                partnership program and customer support.
              </p>
            </div>

            <nav
              aria-label="Explore Rovauto"
              className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[
                {
                  to: "/services",
                  title: "Browse Vehicle Services",
                  description:
                    "Explore repair, maintenance, detailing and roadside services.",
                },
                {
                  to: "/how-it-works",
                  title: "How Rovauto Works",
                  description:
                    "See how booking, garage matching, pickup and delivery work.",
                },
                {
                  to: "/warranty",
                  title: "Service Warranty",
                  description:
                    "Understand the protection included with eligible services.",
                },
                {
                  to: "/about",
                  title: "About Rovauto",
                  description:
                    "Learn why Rovauto was built and how verified garages are selected.",
                },
                {
                  to: "/partner",
                  title: "Partner Your Garage",
                  description:
                    "Join Rovauto and receive nearby service requests.",
                },
                {
                  to: "/contact",
                  title: "Contact Support",
                  description:
                    "Get help with bookings, payments, garages or service questions.",
                },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group rounded-2xl border border-line bg-bg-soft p-5 transition hover:-translate-y-1 hover:border-brand hover:shadow-md"
                >
                  <h3 className="text-lg font-bold text-ink">{item.title}</h3>

                  <p className="mt-2 text-sm leading-6 text-muted">
                    {item.description}
                  </p>

                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
                    Learn more
                    <FiArrowRight className="transition group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section className="container-x pb-16">
          <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-10">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

            <div className="relative grid items-center gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
                  Own a garage? <br /> Grow with Rovauto.
                </h2>

                <p className="mt-4 max-w-md text-sm text-white/70 sm:text-base">
                  Get verified leads, manage jobs, and grow revenue with
                  Rovauto&apos;s garage partner platform.
                </p>

                <div className="mt-6">
                  <Link
                    to="/partner"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-black transition hover:bg-brand-dark"
                  >
                    Become a Partner
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
                {[
                  [partnerStats.garages, "Garages"],
                  [partnerStats.customers, "Customers"],
                  [partnerStats.averageRating, "Avg rating"],
                ].map(([number, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="text-3xl font-bold text-brand">
                      {number ?? "—"}
                    </div>

                    <div className="mt-1 text-xs text-white/70">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
