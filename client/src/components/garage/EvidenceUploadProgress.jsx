import { FiCheckCircle, FiCloud, FiShield } from "react-icons/fi";

const clampProgress = (value) =>
  Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const getStageCopy = (stage, progress) => {
  if (stage === "finalizing") {
    return {
      eyebrow: "EVIDENCE VERIFIED",
      title: "Moving to the next step",
      message: "The inspection evidence is saved. Rovauto is updating the booking now.",
      icon: FiCheckCircle,
    };
  }

  if (stage === "verifying" || progress >= 100) {
    return {
      eyebrow: "UPLOAD COMPLETE",
      title: "Verifying inspection evidence",
      message: "The video has uploaded. Rovauto is validating the files before continuing.",
      icon: FiShield,
    };
  }

  return {
    eyebrow: "SECURE EVIDENCE UPLOAD",
    title: "Uploading photos and video",
    message: "Keep this page open while the inspection evidence is transferred securely.",
    icon: FiCloud,
  };
};

export default function EvidenceUploadProgress({
  visible,
  progress = 0,
  stage = "uploading",
  label = "Inspection evidence",
}) {
  if (!visible) return null;

  const safeProgress = clampProgress(progress);
  const copy = getStageCopy(stage, safeProgress);
  const Icon = copy.icon;
  const circumference = 2 * Math.PI * 48;
  const dashOffset = circumference * (1 - safeProgress / 100);

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label={`${copy.title}. ${safeProgress}% complete.`}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/15 bg-white p-6 shadow-[0_28px_90px_rgba(2,6,23,0.45)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-44 w-44 rounded-full bg-sky-200/40 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            <Icon
              className={stage === "verifying" ? "animate-pulse text-brand-dark" : "text-brand-dark"}
              aria-hidden="true"
            />
            {copy.eyebrow}
          </div>

          <div className="mt-6 grid place-items-center">
            <div className="relative grid h-36 w-36 place-items-center">
              <div
                className="absolute inset-2 rounded-full border border-slate-200 border-t-brand motion-safe:animate-spin"
                aria-hidden="true"
              />
              <svg
                viewBox="0 0 112 112"
                className="h-32 w-32 -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-100"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="text-brand transition-[stroke-dashoffset] duration-300 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-3xl font-black tracking-tight text-ink">
                  {safeProgress}%
                </div>
                <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  {stage === "uploading" ? "uploaded" : "secured"}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xl font-black tracking-tight text-ink sm:text-2xl">
              {copy.title}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              {copy.message}
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-brand transition-[width] duration-300 ease-out"
              style={{ width: `${safeProgress}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg-soft px-3.5 py-3 text-xs">
            <span className="min-w-0 truncate font-bold text-ink">{label}</span>
            <span className="shrink-0 font-semibold text-muted">
              {stage === "uploading" ? "Uploading" : stage === "finalizing" ? "Finalizing" : "Verifying"}
            </span>
          </div>

          <p className="mt-4 text-center text-[11px] font-semibold leading-5 text-slate-500">
            Do not close or refresh this page until the booking moves forward.
          </p>
        </div>
      </div>
    </div>
  );
}
