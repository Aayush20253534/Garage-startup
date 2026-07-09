import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiFacebook,
  FiInstagram,
  FiLinkedin,
  FiMail,
  FiPhone,
  FiTwitter,
  FiYoutube,
} from "react-icons/fi";

import Logo from "@/components/common/Logo";
import { useApp } from "@/hooks/useApp";
import { getServiceCategoryPath } from "@/utils/serviceSlug";

const SUPPORT_PHONE_DISPLAY = "+91 86199 55850";
const SUPPORT_PHONE_HREF = "tel:+918619955850";
const SUPPORT_EMAIL = "rovauto.official@gmail.com";

const SOCIAL_LINKS = [
  {
    Icon: FiInstagram,
    label: "Rovauto on Instagram",
    href: "https://instagram.com/rovauto.official",
  },
  {
    Icon: FiTwitter,
    label: "Rovauto on X",
    href: "https://x.com/Rovauto_ON",
  },
  {
    Icon: FiYoutube,
    label: "Rovauto on YouTube",
    href: "https://www.youtube.com/@Rovauto",
  },
  {
    Icon: FiFacebook,
    label: "Rovauto on Facebook",
    href: "https://www.facebook.com/share/18AVZ22uvY/",
  },
  {
    Icon: FiLinkedin,
    label: "Rovauto on Linkedin",
    href: "https://www.linkedin.com/company/rovauto",
  },
];

const SERVICE_FOOTER_LINKS = [
  {
    label: "Scheduled Service",
    aliases: ["Scheduled Service", "Periodic Service", "General Service"],
  },
  {
    label: "Denting & Painting",
    aliases: ["Denting & Painting", "Denting and Painting"],
  },
  {
    label: "AC Service",
    aliases: ["AC Service", "AC"],
  },
  {
    label: "Battery",
    aliases: ["Battery", "Batteries"],
  },
];

export default function Footer() {
  const { fetchServiceCategories } = useApp();
  const [serviceCategories, setServiceCategories] = useState([]);

  useEffect(() => {
    let mounted = true;

    fetchServiceCategories?.()
      .then((categories) => {
        if (mounted) {
          setServiceCategories(
            Array.isArray(categories) ? categories : [],
          );
        }
      })
      .catch(() => {
        if (mounted) {
          setServiceCategories([]);
        }
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

    return SERVICE_FOOTER_LINKS.map(({ label, aliases }) => {
      const category = aliases
        .map((alias) => categoriesByName.get(alias.toLowerCase()))
        .find(Boolean);

      return [
        label,
        category
          ? getServiceCategoryPath(category)
          : "/services",
      ];
    });
  }, [serviceCategories]);

  const footerColumns = [
    {
      title: "Company",
      links: [
        ["About Rovauto", "/about"],
        ["How It Works", "/how-it-works"],
        ["Partner Your Garage", "/partner"],
        ["Contact Rovauto", "/contact"],
      ],
    },
    {
      title: "Vehicle Services",
      links: serviceLinks,
    },
    {
      title: "Support",
      links: [
        ["Service Warranty", "/warranty"],
        ["Browse All Services", "/services"],
        ["Garage Login", "/garage/login"],
      ],
    },
  ];

  return (
    <footer className="mt-20 bg-ink text-white">
      <div className="container-x grid gap-10 py-12 lg:grid-cols-5 lg:pb-10 lg:pt-14">
        <div className="lg:col-span-2">
          <Link
            to="/"
            aria-label="Rovauto home"
            className="inline-block rounded-2xl bg-white p-3"
          >
            <Logo />
          </Link>

          <p className="mt-5 max-w-sm leading-7 text-white/70">
            Rovauto connects vehicle owners with verified garages for
            transparent vehicle servicing, pickup, progress tracking and
            delivery confirmation.
          </p>

          <address className="mt-5 grid gap-2 not-italic text-sm text-white/70">
            <span>Serving Prayagraj, Uttar Pradesh, India</span>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 transition hover:text-brand"
            >
              <FiMail aria-hidden="true" />
              {SUPPORT_EMAIL}
            </a>

            <a
              href={SUPPORT_PHONE_HREF}
              className="inline-flex items-center gap-2 transition hover:text-brand"
            >
              <FiPhone aria-hidden="true" />
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </address>

          <div className="mt-5 flex flex-wrap gap-2">
            {SOCIAL_LINKS.map(({ Icon, label, href }) => (
              <a
                key={label}
                aria-label={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-brand hover:text-ink"
              >
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        {footerColumns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="mb-4 font-semibold">{column.title}</h2>

            <ul className="grid gap-2 text-sm text-white/70">
              {column.links.map(([label, target]) => (
                <li key={label}>
                  <Link
                    to={target}
                    className="transition hover:text-brand"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-4 text-xs text-white/60 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Rovauto. All rights reserved.
          </p>

          <nav
            aria-label="Legal and support links"
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link to="/contact" className="hover:text-brand">
              Contact
            </Link>
            <Link to="/warranty" className="hover:text-brand">
              Warranty
            </Link>
            <Link to="/partner" className="hover:text-brand">
              Garage Partners
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
