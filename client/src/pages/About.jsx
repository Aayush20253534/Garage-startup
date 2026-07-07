import { LOGO_URL } from "@/data/vehicles";
import { FiTarget, FiHeart, FiZap } from "react-icons/fi";
import Seo, { SITE_URL } from "@/components/seo/Seo";

export default function About() {
  return (
    <>
      <Seo
        title="About Rovauto"
        description="Learn how Rovauto brings trust, transparent pricing and technology to vehicle servicing by connecting car owners with verified garages."
        path="/about"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About Rovauto",
          url: `${SITE_URL}/about`,
          description:
            "Rovauto connects car owners with verified garages through a transparent vehicle service platform.",
        }}
      />

      <div className="container-x py-16">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="chip-brand">About Rovauto</span>
          <h1 className="text-4xl sm:text-6xl font-bold mt-4 leading-tight">
            Reinventing how India services its cars.
          </h1>
          <p className="text-muted mt-5 text-lg">
            Rovauto is on a mission to bring trust, transparency and technology
            to the unorganised vehicle service industry. We connect car owners
            with verified garages — no surprises, no haggling.
          </p>
        </div>
        <div className="aspect-square rounded-3xl bg-bg-soft grid place-items-center">
          <img
            src={LOGO_URL}
            alt="Rovauto vehicle service platform logo"
            width="500"
            height="500"
            loading="lazy"
            decoding="async"
            className="w-2/3"
          />
        </div>
      </div>

      <div className="mt-20 grid md:grid-cols-3 gap-5">
        {[
          {
            icon: FiTarget,
            t: "Our Mission",
            d: "Make car servicing in India as easy and trustworthy as ordering food.",
          },
          {
            icon: FiHeart,
            t: "Our Values",
            d: "Honesty, transparency, and obsessive care for both customers and garage partners.",
          },
          {
            icon: FiZap,
            t: "Our Edge",
            d: "Tech-first ops, WhatsApp-based partner network, and end-to-end quality guarantee.",
          },
        ].map((c) => (
          <div key={c.t} className="card-soft p-6">
            <div className="h-12 w-12 grid place-items-center rounded-2xl bg-ink text-brand">
              <c.icon />
            </div>
            <h2 className="mt-4 font-semibold text-lg">{c.t}</h2>
            <p className="text-muted mt-1">{c.d}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          ["50,000+", "Happy Customers"],
          ["8,000+", "Verified Garages"],
          ["120+", "Cities"],
          ["4.8★", "Avg Rating"],
        ].map(([n, l]) => (
          <div key={l} className="card-soft p-6 text-center">
            <div className="text-3xl sm:text-4xl font-bold text-ink">{n}</div>
            <div className="text-muted text-sm mt-1">{l}</div>
          </div>
        ))}
      </div>
      </div>
    </>
  );
}
