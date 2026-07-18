import { Link } from "react-router-dom";
import { FiArrowLeft, FiFileText, FiShield } from "react-icons/fi";

export default function LegalPageShell({ type, title, description, effectiveDate, sections, children }) {
  const isPrivacy = type === "privacy";
  return (
    <div className="min-h-screen bg-bg-soft">
      <header className="border-b border-line bg-white">
        <div className="container-x py-8 sm:py-12">
          <Link to="/register" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"><FiArrowLeft /> Back to signup</Link>
          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-ink">{isPrivacy ? <FiShield /> : <FiFileText />} Rovauto legal</span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">{description}</p>
            </div>
            <div className="w-fit rounded-xl border border-line bg-bg-soft px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted">Effective date</p><p className="mt-1 font-semibold text-ink">{effectiveDate}</p></div>
          </div>
        </div>
      </header>

      <div className="container-x grid gap-6 py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:py-12">
        <aside className="rounded-xl border border-line bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">On this page</p>
          <nav className="mt-3 max-h-[58vh] space-y-1 overflow-y-auto pr-1">{sections.map((section, index) => <a key={section.id} href={`#${section.id}`} className="flex gap-2 rounded-lg px-2.5 py-2 text-xs leading-4 text-muted transition hover:bg-bg-soft hover:text-ink"><span className="w-5 shrink-0 font-semibold text-ink">{index + 1}.</span><span>{section.title}</span></a>)}</nav>
          <div className="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">View our <Link to={isPrivacy ? "/terms-and-conditions" : "/privacy-policy"} className="font-semibold text-ink underline underline-offset-2">{isPrivacy ? "Terms & Conditions" : "Privacy Policy"}</Link>.</div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-xl border border-line bg-white shadow-sm">
          <div className="border-b border-line bg-ink px-5 py-6 text-base leading-7 text-white/85 sm:px-8">{children}</div>
          <div className="divide-y divide-line">{sections.map((section, index) => <section id={section.id} key={section.id} className="scroll-mt-24 px-5 py-6 sm:px-8 sm:py-8"><div className="flex gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold text-black">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-ink sm:text-xl">{section.title}</h2>{section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-7 text-muted sm:text-base">{paragraph}</p>)}{section.bullets?.length > 0 && <ul className="mt-4 grid gap-2.5">{section.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm leading-6 text-muted sm:text-base"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-dark" /><span>{bullet}</span></li>)}</ul>}{section.content}</div></div></section>)}</div>
        </main>
      </div>
    </div>
  );
}
