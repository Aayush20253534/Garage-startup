import { Link } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { FiInstagram, FiTwitter, FiYoutube, FiFacebook, FiMail, FiPhone } from "react-icons/fi";

export default function Footer() {
  return (
    <footer className="bg-ink text-white mt-20">
      <div className="container-x py-16 grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-3 inline-block"><Logo /></div>
          <p className="mt-5 text-white/70 max-w-sm">India's trusted vehicle service platform. Verified garages, transparent pricing, live tracking & warranty.</p>
          <div className="flex gap-2 mt-5">
            {[FiInstagram, FiTwitter, FiYoutube, FiFacebook].map((Ic, i) => (
              <a key={i} className="grid place-items-center h-10 w-10 rounded-full bg-white/10 hover:bg-brand hover:text-ink transition" href="#"><Ic /></a>
            ))}
          </div>
        </div>
        {[
          { title: "Company", links: [["About Us", "/about"], ["How It Works", "/how-it-works"], ["Partner With Us", "/partner"], ["Contact", "/contact"]] },
          { title: "Services", links: [["Scheduled Service", "/services"], ["Denting & Painting", "/services"], ["AC Service", "/services"], ["Battery", "/services"]] },
          { title: "Support", links: [["Warranty Center", "/warranty"], ["FAQs", "/contact"], ["Garage Login", "/garage"], ["Admin", "/admin"]] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="font-semibold mb-4">{col.title}</h4>
            <ul className="grid gap-2 text-sm text-white/70">
              {col.links.map(([l, t]) => <li key={l}><Link to={t} className="hover:text-brand transition">{l}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Rovauto. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2"><FiMail /> hello@rovauto.in</span>
            <span className="flex items-center gap-2"><FiPhone /> +91 90000 00000</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
