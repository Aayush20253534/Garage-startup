import { FiShield, FiCheckCircle, FiDownload } from "react-icons/fi";
import Seo from "@/components/seo/Seo";

const CARDS = [
  {
    id: "W-2384",
    service: "Standard Service Package",
    vehicle: "Hyundai i20 Petrol",
    start: "12 Jun 2026",
    end: "12 Jul 2026",
    active: true,
  },
  {
    id: "W-2102",
    service: "AC Gas Refill & Service",
    vehicle: "Hyundai i20 Petrol",
    start: "02 May 2026",
    end: "01 Jun 2026",
    active: false,
  },
];

export default function Warranty() {
  return (
    <>
      <Seo
        title="Rovauto Service Warranty"
        description="Learn about Rovauto's 30-day vehicle service warranty and how eligible customers can view or claim warranty support."
        path="/warranty"
      />

      <div className="container-x py-12">
      <div className="flex items-center gap-4 mb-2">
        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand">
          <FiShield className="text-xl" />
        </span>

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Warranty Center</h1>
          <p className="text-muted">
            Every Rovauto service is backed by a 30-day warranty.
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-2xl font-bold text-ink">
        Service warranty cards
      </h2>

      <div className="mt-5 grid lg:grid-cols-2 gap-5">
        {CARDS.map((w) => (
          <div
            key={w.id}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink to-ink-2 p-6 text-white"
          >
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-brand/20 blur-3xl" />

            <div className="relative flex items-center justify-between">
              <span className="chip-brand">
                {w.active ? "Active" : "Expired"}
              </span>

              <span className="text-xs text-white/60">
                Warranty ID • {w.id}
              </span>
            </div>

            <div className="relative mt-6">
              <div className="text-xs text-white/60">Service</div>

              <div className="text-xl font-semibold mt-1">{w.service}</div>

              <div className="mt-3 text-sm text-white/70">{w.vehicle}</div>
            </div>

            <div className="relative mt-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-white/60">Activated</div>
                <div className="font-semibold">{w.start}</div>
              </div>

              <div>
                <div className="text-xs text-white/60">Valid till</div>
                <div className="font-semibold">{w.end}</div>
              </div>
            </div>

            <div className="relative mt-6 flex flex-wrap gap-3">
              <button className="btn-primary">
                <FiCheckCircle />
                Claim
              </button>

              {/* Fixed button */}
              <button className="btn-ghost !bg-white !text-black border-white hover:border-white hover:!bg-gray-100">
                <FiDownload className="!text-black" />
                <span className="!text-black">Card</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
