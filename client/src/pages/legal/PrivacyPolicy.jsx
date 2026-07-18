import LegalPageShell from "@/components/legal/LegalPageShell";

const sections = [
  { id: "information", title: "Information We Collect", bullets: ["Name, phone number, and email address.", "Vehicle details and service history.", "Pickup and delivery address.", "Location data during booking and live tracking.", "Payment information processed through secure payment partners.", "Photos uploaded during pickup and delivery."] },
  { id: "use", title: "How We Use Information", bullets: ["To process bookings and provide pickup and drop services.", "To connect customers with verified garages.", "To improve service quality and customer support.", "To send booking updates and promotional communications."] },
  { id: "sharing", title: "Data Sharing", paragraphs: ["We may share necessary information only with verified garage partners, logistics partners, payment providers, and where required by law."] },
  { id: "security", title: "Data Security", paragraphs: ["We use reasonable administrative and technical safeguards. No online system is completely secure."] },
  { id: "rights", title: "Your Rights", paragraphs: ["You may request correction or deletion of your personal information subject to legal obligations."] },
  { id: "cookies", title: "Cookies", paragraphs: ["Our platform may use cookies and analytics tools to improve user experience."] },
  { id: "updates", title: "Policy Updates", paragraphs: ["We may update this Privacy Policy from time to time. Continued use of Rovauto constitutes acceptance of the updated policy."] },
  { id: "contact", title: "Contact Us", content: <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted sm:text-base"><li><strong className="text-ink">Email:</strong> <a className="underline underline-offset-2" href="mailto:support@rovauto.com">support@rovauto.com</a></li><li><strong className="text-ink">Website:</strong> <a className="underline underline-offset-2" href="https://rovauto.com">https://rovauto.com</a></li></ul> },
];

export default function PrivacyPolicy() {
  return <LegalPageShell type="privacy" title="Privacy Policy" effectiveDate="As published" description="How Rovauto collects, uses, shares, and protects customer information across its website, application, and services." sections={sections}>Rovauto (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) values your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use Rovauto&apos;s website, mobile application, and services.</LegalPageShell>;
}
