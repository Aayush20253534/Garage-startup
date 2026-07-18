const terms = [
  "Rovauto is a technology platform connecting customers with verified automobile service partners.",
  "Customers must provide accurate vehicle, contact and pickup details.",
  "Pickup and delivery shall be verified through OTP and vehicle photographs.",
  "Service estimates are provided by partner garages. Additional work requires customer approval wherever applicable.",
  "Platform fees (currently ₹49–₹99 or as displayed) are non-refundable once a booking is confirmed unless required by law.",
  "Garage commissions are governed by separate partner agreements.",
  "Rovauto strives to onboard verified garages; however, warranty coverage is limited to the terms displayed for each service.",
  "Customers should inspect the vehicle upon delivery and report any issue within the applicable warranty/reporting period.",
  "Users shall not misuse the platform or engage in fraudulent activities.",
  "Rovauto may suspend or terminate accounts violating these terms.",
  "Liability is limited to the extent permitted by applicable law.",
  "These Terms shall be governed by the laws of India. Disputes shall be subject to the courts having jurisdiction over the company's registered office.",
];

export default function TermsAndConditions() {
  return <div className="container-x py-10 sm:py-16"><article className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-dark">Legal</p><h1 className="mt-2 text-3xl font-bold text-ink">Rovauto Terms &amp; Conditions</h1><p className="mt-2 text-sm text-muted">Effective Date: —</p><p className="mt-6 leading-7 text-ink">Welcome to Rovauto. By accessing or using Rovauto&apos;s platform, you agree to these Terms &amp; Conditions.</p><ol className="mt-6 list-decimal space-y-4 pl-5 leading-7 text-ink">{terms.map((term) => <li key={term}>{term}</li>)}</ol><div className="mt-8 border-t border-line pt-6 text-sm text-muted"><p className="font-semibold text-ink">Contact</p><a className="mt-2 block underline" href="mailto:support@rovauto.com">support@rovauto.com</a><a className="mt-1 block underline" href="https://rovauto.com">https://rovauto.com</a></div></article></div>;
}
