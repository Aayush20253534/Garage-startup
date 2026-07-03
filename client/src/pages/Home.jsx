import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiShield,
  FiClock,
  FiTool,
  FiNavigation,
  FiStar,
  FiArrowRight,
} from "react-icons/fi";
import { CATEGORY_UI } from "@/data/services";
import api from "@/api/axios";
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

const getServicePrice = (service) => {
  return service?.basePrice || service?.minPrice || 0;
};

const formatCount = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number >= 1000) return `${Math.floor(number / 1000)}K+`;
  return String(number);
};

export default function Home() {
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
      .get("/services/categories")
      .then((response) => {
        if (!mounted) return;

        const serviceCategories = response.data?.data || [];
        const services = serviceCategories
          .flatMap((category) =>
            (category.services || []).map((service) => ({
              ...service,
              category,
            })),
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
  }, []);

  return (
    <div>
      <section className="relative min-h-[78vh] overflow-hidden flex items-start lg:min-h-[calc(100vh-96px)]">
        <div className="absolute inset-0 -z-10">
          <img
            alt="Rovauto workshop"
            src={homepageHero}
            className="h-full w-full object-cover object-center"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/15" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>

        <div className="container-x relative z-10 py-10 sm:py-14 lg:pt-16 lg:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl text-white"
          >
            <span className="chip-brand mb-4 bg-white/10 text-white border-white/10 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              New in Prayagraj
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
              India&apos;s Trusted{" "}
              <span className="relative inline-block">Vehicle Service</span>{" "}
              Platform
            </h1>

            <p className="mt-5 text-lg text-white/85 max-w-xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
              Book trusted vehicle services from verified garages with
              transparent pricing, live tracking and a 30-day service warranty.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/booking/vehicle"
                className="btn-primary text-base px-6 py-3.5 shadow-2xl"
              >
                Book Service <FiArrowRight />
              </Link>

              <Link
                to="/partner"
                className="btn-ghost text-base px-6 py-3.5 border-white/20 bg-white/10 text-white hover:border-white hover:bg-white/10"
              >
                Become a Partner
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-2 text-sm text-white/85"
                >
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-white/15 text-white backdrop-blur">
                    <t.icon className="text-xs" />
                  </span>

                  {t.label}
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center gap-4">
              <div className="flex -space-x-3">
                {["A", "R", "S", "P"].map((c, i) => (
                  <span
                    key={i}
                    className="grid place-items-center h-9 w-9 rounded-full bg-white text-ink text-xs font-bold border-2 border-black/10"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <div className="text-sm">
                <div className="flex items-center gap-1 text-amber-300">
                  <FiStar fill="currentColor" />
                  <FiStar fill="currentColor" />
                  <FiStar fill="currentColor" />
                  <FiStar fill="currentColor" />
                  <FiStar fill="currentColor" />
                </div>

                <div className="text-white/70 text-xs">
                  Trusted by 50,000+ vehicle owners
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="container-x py-16">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Vehicle services at your doorstep
            </h2>

            <p className="text-muted mt-2">
              Verified mechanics · Transparent pricing · 30-day warranty
            </p>
          </div>

          <Link to="/services" className="btn-ghost">
            View all <FiArrowRight />
          </Link>
        </div>

        {loading ? (
          <div className="card-soft p-8 text-muted">Loading services...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
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
                  <div className="flex h-[250px] flex-col overflow-hidden rounded-3xl bg-white p-4 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl sm:h-auto sm:p-5">
                    <div className="mb-3 min-h-[52px] text-lg font-bold leading-tight sm:mb-4 sm:min-h-0">
                      {category.name}
                    </div>

                    <div className="mt-auto h-32 w-full overflow-hidden rounded-2xl bg-bg-soft">
                      {image ? (
                        <img
                          src={image}
                          alt={category.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-muted">
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

      <section className="bg-bg-soft py-20">
        <div className="container-x">
          <div className="text-center max-w-2xl mx-auto">
            <span className="chip-brand">How it works</span>

            <h2 className="text-3xl sm:text-4xl font-bold mt-4">
              From booking to warranty in 4 steps
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-4 gap-5">
            {[
              ["Add your car", "Tell us your brand, model & fuel."],
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
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="card-soft p-6"
              >
                <div className="h-10 w-10 grid place-items-center rounded-full bg-ink text-brand font-bold">
                  {index + 1}
                </div>

                <h3 className="mt-4 font-semibold text-lg">{title}</h3>

                <p className="text-sm text-muted mt-1">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x py-20">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold">Popular this week</h2>

          <Link to="/services" className="btn-ghost">
            Browse all services <FiArrowRight />
          </Link>
        </div>

        {loading ? (
          <div className="card-soft p-8 text-muted">
            Loading popular services...
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {popularServices.map((service) => {
              const image = getServiceThumbnailUrl(service);
              const price = getServicePrice(service);

              return (
                <Link
                  to="/booking/services"
                  key={service.id}
                  className="card-soft p-5 hover:-translate-y-1 transition group"
                >
                  {image && (
                    <div className="h-40 w-full rounded-2xl overflow-hidden mb-4">
                      <img
                        src={image}
                        alt={service.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg group-hover:text-ink">
                        {service.name}
                      </h3>

                      <p className="text-sm text-muted mt-1 line-clamp-2">
                        {service.description}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-muted">From</div>
                      <div className="font-bold text-xl">₹{price}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-500 text-sm">
                      <FiStar fill="currentColor" /> {service.rating}
                    </div>

                    <span className="text-sm font-semibold text-ink/80 group-hover:text-ink">
                      Add <FiArrowRight className="inline" />
                    </span>
                  </div>
                </Link>
              );
            })}

            {popularServices.length === 0 && (
              <div className="card-soft p-8 text-muted">
                No popular services found.
              </div>
            )}
          </div>
        )}
      </section>

      <section className="container-x pb-20">
        <div className="rounded-3xl bg-ink text-white overflow-hidden relative p-8 sm:p-14">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-5xl font-bold leading-tight">
                Own a garage? <br /> Grow with Rovauto.
              </h2>

              <p className="text-white/70 mt-4 max-w-md">
                Get verified leads, manage jobs, and grow revenue with
                Rovauto&apos;s garage partner platform.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/partner" className="btn-primary">
                  Become a Partner
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              {[
                [partnerStats.garages, "Garages"],
                [partnerStats.customers, "Customers"],
                ["4.8★", "Avg rating"],
              ].map(([number, label]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-white/5 border border-white/10 p-5"
                >
                  <div className="text-3xl font-bold text-brand">{number}</div>

                  <div className="text-xs text-white/70 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
