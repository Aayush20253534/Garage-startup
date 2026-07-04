import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
import api from "@/api/axios";
import { useApp } from "@/hooks/useApp";
import homepageHero from "@/assets/Rovauto_home.png";
import {
  getCategoryThumbnailUrl,
  getServiceImageUrls,
  getServiceThumbnailUrl,
  warmImageCache,
} from "@/utils/imageCache";

const TRUST = [
  { icon: FiCheckCircle, label: "Verified Garages" },
  { icon: FiShield, label: "Service Warranty" },
  { icon: FiTool, label: "Transparent Pricing" },
  { icon: FiNavigation, label: "Live Tracking" },
  { icon: FiClock, label: "Fast Booking" },
];

const formatCount = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number >= 1000) return `${Math.floor(number / 1000)}K+`;
  return String(number);
};

export default function Home() {
  const { user, vehicle, location } = useApp();

  const [categories, setCategories] = useState([]);
  const [popularServices, setPopularServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partnerStats, setPartnerStats] = useState({
    garages: "8K+",
    customers: "50K+",
  });

  useEffect(() => {
    let mounted = true;

    api
      .get("/public/stats")
      .then((response) => {
        if (!mounted) return;

        const stats = response.data?.data || response.data || {};

        setPartnerStats({
          garages: formatCount(stats.garages, "8K+"),
          customers: formatCount(stats.customers, "50K+"),
        });
      })
      .catch(() => null);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    api
      .get("/services/categories", {
        params: user
          ? {
              ...(vehicle?.id && { vehicleId: vehicle.id }),
              ...(location?.city && { city: location.city }),
            }
          : {},
      })
      .then((response) => {
        if (!mounted) return;

        const serviceCategories = response.data?.data || [];

        const services = serviceCategories
          .flatMap((category) =>
            (category.services || []).map((service) => ({
              ...service,
              category,
            }))
          )
          .slice(0, 6);

        setCategories(serviceCategories);
        setPopularServices(services);
        warmImageCache(getServiceImageUrls(serviceCategories));
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
  }, [user, vehicle?.id, location?.city]);

  return (
    <div className="overflow-x-hidden">
      <section className="relative flex min-h-[72vh] items-start overflow-hidden lg:min-h-[calc(100vh-96px)]">
        <div className="absolute inset-0 -z-10">
          <img
            alt="Rovauto workshop"
            src={homepageHero}
            className="h-full w-full object-cover object-center"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>

        <div className="container-x relative z-10 py-10 sm:py-14 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl text-white"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              New in Prayagraj
            </span>

            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-7xl">
              India&apos;s Trusted Vehicle Service Platform
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-lg">
              Book trusted vehicle services from verified garages with
              transparent pricing, live tracking, and a 30-day service warranty.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/booking/vehicle"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-black shadow-2xl transition hover:bg-brand-dark"
              >
                Book Service <FiArrowRight />
              </Link>

              <Link
                to="/partner"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 text-sm font-bold text-white transition hover:border-white hover:bg-white/15"
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
                <div className="flex items-center gap-1 text-amber-300">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <FiStar key={item} fill="currentColor" />
                  ))}
                </div>

                <div className="text-xs text-white/70">
                  Trusted by 50,000+ vehicle owners
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="container-x py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-ink sm:text-4xl">
              Vehicle services at your doorstep
            </h2>

            <p className="mt-2 text-sm text-muted sm:text-base">
              Verified mechanics · Transparent pricing · 30-day warranty
            </p>
          </div>

          <Link
            to="/services"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
          >
            View all <FiArrowRight />
          </Link>
        </div>

        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading services...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {categories.slice(0, 8).map((category) => {
              const ui = CATEGORY_UI[category.name] || {};
              const image = getCategoryThumbnailUrl(category);
              const isSos = ui.isSos;

              return (
                <Link
                  to={isSos ? "/sos" : `/services/${category.id}`}
                  key={category.id}
                  className="group"
                >
                  <div className="flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                    <div className="mb-4 min-h-[48px] text-lg font-bold leading-tight text-ink">
                      {category.name}
                    </div>

                    <div className="flex-1 overflow-hidden rounded-xl bg-bg-soft">
                      {image ? (
                        <img
                          src={image}
                          alt={category.name}
                          className="h-full min-h-[200px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full min-h-[200px] w-full place-items-center text-muted">
                          <FiTool />
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
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
              From booking to warranty in 4 steps
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
              ["Live tracking", "Track status, talk to mechanic, get warranty."],
            ].map(([title, desc], index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="card-soft rounded-2xl p-4 shadow-sm"
              >
                <div className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-brand">
                  {index + 1}
                </div>

                <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-muted">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-3xl font-bold text-ink sm:text-4xl">
            Popular this week
          </h2>

          <Link
            to="/services"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft"
          >
            Browse all services <FiArrowRight />
          </Link>
        </div>

        {loading ? (
          <div className="card-soft rounded-2xl p-5 text-sm text-muted">
            Loading popular services...
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularServices.map((service) => {
              const image = getServiceThumbnailUrl(service);
              const hasPrice = Boolean(user && service.priceRange);
              const price = service.priceRange?.min;

              return (
                <Link
                  to="/booking/services"
                  key={service.id}
                  className="card-soft group rounded-2xl p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  {image && (
                    <div className="mb-4 h-40 w-full overflow-hidden rounded-xl bg-bg-soft">
                      <img
                        src={image}
                        alt={service.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-ink">
                        {service.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {service.description}
                      </p>
                    </div>

                    {hasPrice && (
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-muted">From</div>
                        <div className="text-xl font-bold text-ink">
                          ₹{price}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm text-amber-500">
                      <FiStar fill="currentColor" /> {service.rating || "4.8"}
                    </div>

                    <span className="text-sm font-semibold text-ink/80 group-hover:text-ink">
                      Add <FiArrowRight className="inline" />
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
                ["4.8★", "Avg rating"],
              ].map(([number, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="text-3xl font-bold text-brand">{number}</div>
                  <div className="mt-1 text-xs text-white/70">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}