import LegalPageShell from "@/components/legal/LegalPageShell";

const sections = [
  { id: "eligibility", title: "Eligibility", bullets: ["Valid business registrations, licences, GST registration (if applicable), and required permits must be maintained.", "Qualified technicians and the equipment required to perform accepted services must be available."] },
  { id: "verification", title: "Verification", bullets: ["Rovauto may verify documents, premises, ownership, staff credentials, and service quality at any time.", "False, incomplete, or misleading information may result in termination."] },
  { id: "service-quality", title: "Service Quality", bullets: ["Services must be performed professionally and honestly.", "Only genuine or customer-approved parts may be used.", "Hidden charges and unnecessary repairs are prohibited."] },
  { id: "price-transparency", title: "Price Transparency", bullets: ["Provide an accurate estimate before beginning work.", "Obtain customer approval through Rovauto before carrying out additional repairs."] },
  { id: "customer-communication", title: "Customer Communication", bullets: ["Booking-related communication must take place through Rovauto unless otherwise approved.", "All customer interactions must remain professional."] },
  { id: "vehicle-handling", title: "Vehicle Handling", paragraphs: ["The Garage is fully responsible for a customer vehicle while it is in the Garage's possession, including damage caused by negligence, theft, fire, misuse, or unauthorised use."] },
  { id: "pickup-delivery", title: "Pickup & Delivery", bullets: ["Photograph and document the vehicle's condition during pickup.", "Communicate delays immediately."] },
  { id: "warranty", title: "Warranty", paragraphs: ["Eligible repairs and parts must be covered under the warranty agreed for the service."] },
  { id: "service-records", title: "Service Records", bullets: ["Maintain inspection records, invoices, photographs, replaced-part details, and customer approvals.", "Rovauto may audit these records at any time."] },
  { id: "inspection-rights", title: "Inspection Rights", paragraphs: ["Rovauto may conduct surprise inspections, audits, and mystery-customer evaluations without prior notice."] },
  { id: "prohibited-activities", title: "Prohibited Activities", bullets: ["Overcharging", "Unauthorised repairs", "Fake invoices or reports", "Manipulating reviews", "Misusing customer information", "Accepting fraudulent bookings", "Bypassing Rovauto for direct business", "Using Rovauto branding without authorisation"] },
  { id: "parts-fraud", title: "Parts Replacement & Fraud", bullets: ["Do not replace genuine parts with duplicate, counterfeit, refurbished, used, or inferior parts without prior written approval through Rovauto.", "Unauthorised replacement, tampering, theft, or counterfeit installation constitutes fraud and a material breach.", "Rovauto may suspend or terminate the Garage, withhold payments, recover damages and legal costs, blacklist the Garage and its owners, notify affected customers or law enforcement, and pursue civil or criminal remedies under Indian law.", "The Garage is solely responsible for resulting financial losses, claims, liabilities, penalties, compensation, and reputational damage."] },
  { id: "customer-data", title: "Customer Data", paragraphs: ["Customer information is the exclusive property of Rovauto and must not be copied, sold, shared, or used outside the booked service."] },
  { id: "commission", title: "Platform Commission", paragraphs: ["The applicable Rovauto commission is payable for every completed booking."] },
  { id: "payments", title: "Payments", paragraphs: ["Rovauto may withhold payments during investigations, disputes, chargebacks, or policy-violation reviews."] },
  { id: "penalties", title: "Penalties", paragraphs: ["Penalties may apply for fraud, fake invoices, delays, poor ratings, misconduct, unauthorised cancellations, or other policy violations."] },
  { id: "termination", title: "Suspension & Termination", paragraphs: ["Rovauto may suspend or permanently terminate a Garage without notice for fraud, safety risks, fake documents, repeated complaints, policy breaches, or illegal activity."] },
  { id: "liability", title: "Liability & Indemnity", paragraphs: ["The Garage will indemnify Rovauto against claims, damages, penalties, and legal proceedings arising from the Garage's negligence or misconduct."] },
  { id: "insurance", title: "Insurance", paragraphs: ["The Garage must maintain appropriate insurance for its premises, employees, customer vehicles, and third-party liabilities."] },
  { id: "confidentiality", title: "Confidentiality", paragraphs: ["Rovauto business information and customer data must be kept confidential."] },
  { id: "non-circumvention", title: "Non-Circumvention", paragraphs: ["The Garage must not directly solicit Rovauto customers outside the platform for 24 months after the customer's last booking."] },
  { id: "force-majeure", title: "Force Majeure", paragraphs: ["Neither party is liable for a failure caused by circumstances beyond its reasonable control."] },
  { id: "modifications", title: "Modification of Terms", paragraphs: ["Rovauto may modify these Terms & Conditions at any time."] },
  { id: "governing-law", title: "Governing Law", paragraphs: ["These Terms & Conditions are governed by the laws of India."] },
  { id: "contact", title: "Contact", bullets: ["Email: rovauto.official@gmail.com", "Phone: +91 9354906339"] },
];

export default function GaragePartnerTerms() {
  return (
    <LegalPageShell type="garage" title="Garage Partner Agreement Terms & Conditions" description="The terms governing the relationship between Rovauto and its Garage Partners." effectiveDate="18 July 2026" sections={sections} backTo="/garage/onboarding" backLabel="Back to garage application">
      <p>These Terms & Conditions govern the relationship between Rovauto (the “Platform”, “Company”, “We”, or “Us”) and the Garage Partner (“Garage”, “Service Partner”, or “You”). By registering with Rovauto, you agree to comply with these Terms.</p>
      <div className="mt-5 rounded-lg border border-line bg-bg-soft p-4">
        <h2 className="font-bold text-ink">Declaration</h2>
        <p className="mt-2">I declare that the information provided is true and agree to comply with all Rovauto policies and these Terms & Conditions. I understand that violations may result in penalties, recovery of damages, legal action, suspension, or permanent removal from the Rovauto platform.</p>
      </div>
    </LegalPageShell>
  );
}
