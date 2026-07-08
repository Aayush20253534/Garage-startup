import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiCheckCircle,
  FiDatabase,
  FiRefreshCw,
  FiShield,
  FiTrash2,
  FiZap,
} from "react-icons/fi";

const targetTypes = [
  { value: "id", label: "User ID" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "name", label: "Exact name" },
];

const toneClass = {
  warning: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    button: "bg-amber-600 text-white hover:bg-amber-700",
    icon: "bg-amber-100 text-amber-700",
  },
  danger: {
    badge: "border-red-200 bg-red-50 text-red-700",
    button: "bg-red-600 text-white hover:bg-red-700",
    icon: "bg-red-100 text-red-700",
  },
  critical: {
    badge: "border-red-700 bg-red-700 text-white",
    button: "bg-red-700 text-white hover:bg-red-800",
    icon: "bg-red-700 text-white",
  },
};

const controlClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-ink";

const getDefaultPayload = (command) => {
  if (command.fields?.includes("targetType")) {
    return {
      targetType: "email",
      targetValue: "",
    };
  }

  if (command.fields?.includes("customerEmail")) {
    return {
      customerEmail: "",
    };
  }

  return {};
};

const formatJson = (value) => JSON.stringify(value, null, 2);

function DangerousCommandCard({ command, onRun, running, result }) {
  const [confirmation, setConfirmation] = useState("");
  const [payload, setPayload] = useState(() => getDefaultPayload(command));
  const classes = toneClass[command.tone] || toneClass.danger;
  const requiresUserTarget = command.fields?.includes("targetType");
  const requiresCustomerEmail = command.fields?.includes("customerEmail");
  const expected = command.confirmation;
  const canRun = confirmation === expected && !running;

  const updatePayload = (key, value) => {
    setPayload((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${classes.icon}`}>
              {command.tone === "critical" ? <FiAlertOctagon /> : <FiTrash2 />}
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">{command.label}</h2>
              <p className="text-xs font-semibold text-muted">{command.command}</p>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">
            {command.description}
          </p>
        </div>

        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${classes.badge}`}>
          {command.tone}
        </span>
      </div>

      {(requiresUserTarget || requiresCustomerEmail) && (
        <div className="mt-5 grid gap-3 rounded-xl border border-line bg-bg-soft p-4 md:grid-cols-2">
          {requiresUserTarget && (
            <>
              <label className="block text-sm font-semibold text-ink">
                Target type
                <select
                  value={payload.targetType || "email"}
                  onChange={(event) => updatePayload("targetType", event.target.value)}
                  className={`${controlClass} mt-2`}
                >
                  {targetTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-ink">
                Target value
                <input
                  value={payload.targetValue || ""}
                  onChange={(event) => updatePayload("targetValue", event.target.value)}
                  className={`${controlClass} mt-2`}
                  placeholder="Paste the exact user identifier"
                />
              </label>

              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 md:col-span-2">
                Owned garages are always deleted with this user, including garage bookings, applications, media, and Cloudinary files.
              </div>
            </>
          )}

          {requiresCustomerEmail && (
            <label className="block text-sm font-semibold text-ink md:col-span-2">
              Customer email
              <input
                type="email"
                value={payload.customerEmail || ""}
                onChange={(event) => updatePayload("customerEmail", event.target.value)}
                className={`${controlClass} mt-2`}
                placeholder="customer@example.com"
              />
            </label>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label className="block text-sm font-semibold text-ink">
          Confirmation text
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className={`${controlClass} mt-2 font-mono`}
            placeholder={expected}
          />
          <span className="mt-2 block text-xs text-muted">
            Type <span className="font-mono font-bold text-ink">{expected}</span> exactly.
          </span>
        </label>

        <button
          type="button"
          disabled={!canRun}
          onClick={() => onRun(command, { confirmation, payload })}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 ${classes.button}`}
        >
          {running ? <FiRefreshCw className="animate-spin" /> : <FiZap />}
          {running ? "Running..." : "Run command"}
        </button>
      </div>

      {result && (
        <div className="mt-5 rounded-xl border border-line bg-gray-950 p-4 text-white">
          <div className="flex items-center gap-2 text-sm font-bold text-green-300">
            <FiCheckCircle /> Last result
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-gray-200">
            {formatJson(result)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function Dangerous() {
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningCommand, setRunningCommand] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState({});

  const groupedCommands = useMemo(() => {
    const critical = commands.filter((command) => command.tone === "critical");
    const destructive = commands.filter((command) => command.tone === "danger");
    const maintenance = commands.filter((command) => command.tone === "warning");

    return [
      { title: "Critical nukes", commands: critical },
      { title: "Delete scripts", commands: destructive },
      { title: "Maintenance scripts", commands: maintenance },
    ].filter((group) => group.commands.length > 0);
  }, [commands]);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await adminApi.getDangerousCommands();
      setCommands(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load dangerous commands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runCommand = async (command, body) => {
    setRunningCommand(command.command);
    setError("");

    try {
      const result = await adminApi.runDangerousCommand(command.command, body);
      setResults((current) => ({ ...current, [command.command]: result }));
    } catch (err) {
      setError(err.response?.data?.message || "Command failed");
    } finally {
      setRunningCommand("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-red-700">
              Admin dangerous zone
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-ink">
              Dangerous scripts
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-red-800/80">
              These actions permanently delete production data. Every command requires the exact confirmation phrase: rovauto plus the command name.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-bold text-red-700 transition hover:bg-red-100"
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <FiShield className="text-xl text-ink" />
          <p className="mt-3 text-sm font-bold text-ink">Admin only</p>
          <p className="mt-1 text-xs leading-5 text-muted">Backend route rejects interns and customers.</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <FiDatabase className="text-xl text-ink" />
          <p className="mt-3 text-sm font-bold text-ink">DB + Cloudinary</p>
          <p className="mt-1 text-xs leading-5 text-muted">DB-backed media public IDs are deleted after the database action.</p>
        </div>
        <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
          <FiAlertTriangle className="text-xl text-red-600" />
          <p className="mt-3 text-sm font-bold text-ink">No soft delete</p>
          <p className="mt-1 text-xs leading-5 text-muted">Run only after you have backups.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-muted shadow-sm">
          Loading dangerous commands...
        </div>
      ) : (
        groupedCommands.map((group) => (
          <section key={group.title} className="space-y-4">
            <h2 className="text-lg font-extrabold text-ink">{group.title}</h2>
            <div className="grid gap-4">
              {group.commands.map((command) => (
                <DangerousCommandCard
                  key={command.command}
                  command={command}
                  onRun={runCommand}
                  running={runningCommand === command.command}
                  result={results[command.command]}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
