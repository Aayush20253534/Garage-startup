import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FiActivity, FiAlertTriangle, FiServer } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";
import IntegrationHealth from "@/pages/admin/IntegrationHealth";
import SystemIssues from "@/pages/admin/SystemIssues";

const VIEW_ISSUES = "issues";
const VIEW_INTEGRATIONS = "integrations";

export default function SystemHealth() {
  const { user } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMainAdmin = user?.role === "ADMIN";
  const requestedView = searchParams.get("view");
  const activeView =
    requestedView === VIEW_INTEGRATIONS && isMainAdmin
      ? VIEW_INTEGRATIONS
      : VIEW_ISSUES;

  useEffect(() => {
    const isValidView =
      requestedView === VIEW_ISSUES ||
      (requestedView === VIEW_INTEGRATIONS && isMainAdmin);

    if (!isValidView) {
      setSearchParams({ view: VIEW_ISSUES }, { replace: true });
    }
  }, [isMainAdmin, requestedView, setSearchParams]);

  const selectView = (view) => {
    setSearchParams({ view });
  };

  const tabs = [
    {
      key: VIEW_ISSUES,
      label: "System Issues",
      description: "Recorded frontend, backend and worker failures",
      icon: FiAlertTriangle,
    },
    ...(isMainAdmin
      ? [
          {
            key: VIEW_INTEGRATIONS,
            label: "Integration Health",
            description: "Live infrastructure and provider checks",
            icon: FiServer,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5 overflow-x-hidden pb-10">
      <header className="border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center border border-line bg-bg-soft text-xl text-ink">
            <FiActivity />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
              Engineering Operations
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-ink">System Health</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Review application errors and inspect the health of Rovauto infrastructure and connected providers from one place.
            </p>
          </div>
        </div>
      </header>

      <nav
        aria-label="System health views"
        className="grid gap-3 border border-line bg-white p-3 shadow-sm md:grid-cols-2"
      >
        {tabs.map(({ key, label, description, icon: Icon }) => {
          const selected = activeView === key;

          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => selectView(key)}
              className={[
                "flex min-h-20 items-center gap-3 border px-4 py-3 text-left transition",
                selected
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-ink hover:bg-bg-soft",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-10 w-10 shrink-0 place-items-center border text-lg",
                  selected
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-line bg-bg-soft text-ink",
                ].join(" ")}
              >
                <Icon />
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold">{label}</span>
                <span
                  className={[
                    "mt-1 block text-xs leading-5",
                    selected ? "text-white/70" : "text-muted",
                  ].join(" ")}
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {activeView === VIEW_INTEGRATIONS ? (
        <IntegrationHealth embedded />
      ) : (
        <SystemIssues embedded />
      )}
    </div>
  );
}
