import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { useApp } from "@/hooks/useApp";
import {
  FiInstagram,
  FiTwitter,
  FiYoutube,
  FiFacebook,
  FiMail,
  FiPhone,
} from "react-icons/fi";

const SUPPORT_PHONE_DISPLAY = "+91 98993 19913";

const serviceFooterLinks = [
  {
    label: "Scheduled Service",
    aliases: ["Scheduled Service", "Periodic Service", "General Service"],
  },
  {
    label: "Denting & Painting",
    aliases: ["Denting & Painting", "Denting and Painting"],
  },
  { label: "AC Service", aliases: ["AC Service", "AC"] },
  { label: "Battery", aliases: ["Battery", "Batteries"] },
];

export default function Footer() {
  const { fetchServiceCategories } = useApp();
  const [serviceCategories, setServiceCategories] = useState([]);

  useEffect(() => {
    let mounted = true;

    fetchServiceCategories?.()
      .then((categories) => {
        if (mounted) {
          setServiceCategories(Array.isArray(categories) ? categories : []);
        }
      })
      .catch(() => {
        if (mounted) setServiceCategories([]);
      });

    return () => {
      mounted = false;
    };
  }, [fetchServiceCategories]);

  const serviceLinks = useMemo(() => {
    const categoriesByName = new Map(
      serviceCategories.map((category) => [
        String(category.name || "").toLowerCase(),
        category,
      ]),
    );

    return serviceFooterLinks.map(({ label, aliases }) => {
      const category = aliases
        .map((alias) => categoriesByName.get(alias.toLowerCase()))
        .find(Boolean);

      return [label, category?.id ? `/services/${category.id}` : "/services"];
    });
  }, [serviceCategories]);

  const footerColumns = [
    {
      title: "Company",
      links: [
        ["About Us", "/about"],
        ["How It Works", "/how-it-works"],
        ["Partner With Us", "/partner"],
        ["Contact", "/contact"],
      ],
    },
    {
      title: "Services",
      links: serviceLinks,
    },
    {
      title: "Support",
      links: [
        ["Warranty Center", "/warranty"],
        ["FAQs", "/contact"],
        ["Garage Login", "/garage"],
        ["Admin", "/admin"],
      ],
    },
  ];

  return (
    <footer className="bg-ink text-white mt-20">
      <div className="container-x py-12 lg:pt-14 lg:pb-10 grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-3 inline-block">
            <Logo />
          </div>
          <p className="mt-5 text-white/70 max-w-sm">
            India's trusted vehicle service platform. Verified garages,
            transparent pricing, live tracking & warranty.
          </p>
          <div className="flex gap-2 mt-5">
            {[
              {
                Icon: FiInstagram,
                href: "https://instagram.com/rovauto.official",
              },
              { Icon: FiTwitter, href: "https://x.com/Rovauto_ON" },
              { Icon: FiYoutube, href: "https://www.youtube.com/@Rovauto" },
              {
                Icon: FiFacebook,
                href: "https://www.facebook.com/share/18AVZ22uvY/",
              },
            ].map(({ Icon, href }, i) => (
              <a
                key={i}
                target="_blank"
                rel="noopener noreferrer"
                className="grid place-items-center h-10 w-10 rounded-full bg-white/10 hover:bg-brand hover:text-ink transition"
                href={href}
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <h4 className="font-semibold mb-4">{col.title}</h4>
            <ul className="grid gap-2 text-sm text-white/70">
              {col.links.map(([l, t]) => (
                <li key={l}>
                  <Link to={t} className="hover:text-brand transition">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>
            © {new Date().getFullYear()} Rovauto. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <FiMail /> rovauto.offical@gmail.com
            </span>
            <span className="flex items-center gap-2">
              <FiPhone /> {SUPPORT_PHONE_DISPLAY}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
