import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Seo from "@/components/seo/Seo";
import {
  FiCheckCircle,
  FiMapPin,
  FiNavigation,
  FiPackage,
  FiShield,
  FiTruck,
} from "react-icons/fi";

const STEPS = [
  {
    icon: FiTruck,
    title: "Add Your Vehicle",
    desc: "Pick your brand, model, and fuel type. Services are tailored to your exact vehicle.",
  },
  {
    icon: FiPackage,
    title: "Pick Services",
    desc: "Browse curated packages with transparent prices and add multiple services to your cart.",
  },
  {
    icon: FiMapPin,
    title: "Choose Location",
    desc: "Tell us where service is needed: at home or through the nearest verified garage.",
  },
  {
    icon: FiCheckCircle,
    title: "Auto-Assign Garage",
    desc: "We assign the best garage based on rating, distance, availability, and service quality.",
  },
  {
    icon: FiNavigation,
    title: "Live Tracking",
    desc: "Track each step from garage assignment to service progress and final quality check.",
  },
  {
    icon: FiShield,
    title: "Warranty Activated",
    desc: "Get a 30-day service warranty card directly on your dashboard after completion.",
  },
];

function HowItWorks() {
  return (
    <>
      <Seo
        title="How Rovauto Vehicle Service Booking Works"
        description="See how Rovauto handles vehicle selection, service booking, verified garage assignment, live tracking and service warranty in six simple steps."
        path="/how-it-works"
      />

      <div className="container-x py-10 sm:py-14">
      <section className="mx-auto max-w-6xl space-y-8 overflow-x-hidden">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-ink">
            How Rovauto Works
          </span>

          <h1 className="mt-4 text-3xl font-bold leading-tight text-ink sm:text-5xl">
            Service your car in 6 simple steps
          </h1>

          <p className="mt-3 text-sm text-muted sm:text-base">
            From vehicle selection to warranty, the entire flow is built so your
            car gets serviced without turning your day into paperwork cosplay.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;

            return (
              <motion.article
                key={step.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
                className="card-soft rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl text-black">
                    <Icon />
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-muted">
                      Step {index + 1}
                    </div>

                    <h3 className="mt-1 text-lg font-bold text-ink">
                      {step.title}
                    </h3>

                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="rounded-3xl bg-ink p-6 text-center text-white shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">Ready to book?</h2>

          <p className="mx-auto mt-2 max-w-xl text-sm text-white/70">
            Start with your vehicle and Rovauto will guide the rest. A rare case
            where clicking a button may actually reduce chaos.
          </p>

          <Link
            to="/booking/vehicle"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand px-6 text-sm font-bold text-black transition hover:bg-brand-dark"
          >
            Start Booking
          </Link>
        </div>
      </section>
      </div>
    </>
  );
}

export { HowItWorks };
export default HowItWorks;
