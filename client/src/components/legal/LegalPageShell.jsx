import { Link } from "react-router-dom";

export default function LegalPageShell({ type, title, description, effectiveDate, sections, children, backTo = "/register", backLabel = "Back to signup" }) {
  const otherPolicy = type === "privacy"
    ? { to: "/terms-and-conditions", label: "Terms & Conditions" }
    : { to: "/privacy-policy", label: "Privacy Policy" };

  return (
    <div className="min-h-screen bg-bg-soft py-8 sm:py-12">
      <main className="container-x">
        <article className="mx-auto max-w-4xl rounded-xl border border-line bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10">
          <Link to={backTo} className="text-sm font-medium text-muted underline underline-offset-2 hover:text-ink">{backLabel}</Link>

          <header className="mt-6 border-b border-line pb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rovauto Legal</p>
            <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-muted sm:text-base">{description}</p>
            <p className="mt-4 text-sm text-ink"><strong>Effective Date:</strong> {effectiveDate}</p>
          </header>

          <div className="border-b border-line py-6 text-sm leading-7 text-ink sm:text-base">{children}</div>

          <ol className="mt-2 divide-y divide-line">
            {sections.map((section, index) => (
              <li id={section.id} key={section.id} className="scroll-mt-20 py-6">
                <h2 className="text-lg font-bold text-ink sm:text-xl">{index + 1}. {section.title}</h2>
                {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-7 text-muted sm:text-base">{paragraph}</p>)}
                {section.bullets?.length > 0 && (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted marker:text-ink sm:text-base">
                    {section.bullets.map((bullet) => <li key={bullet} className="pl-1">{bullet}</li>)}
                  </ul>
                )}
                {section.content}
              </li>
            ))}
          </ol>

          <footer className="border-t border-line pt-6 text-sm text-muted">
            Also read the <Link to={otherPolicy.to} className="font-semibold text-ink underline underline-offset-2">{otherPolicy.label}</Link>.
          </footer>
        </article>
      </main>
    </div>
  );
}
