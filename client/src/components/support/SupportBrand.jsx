export default function SupportBrand({ compact = false, className = "" }) {
  return (
    <div className={["flex min-w-0 items-center gap-3", className].join(" ")}>
      <img
        src="/support-brand-v4-icon-512.png"
        alt="Rovauto Support"
        width="512"
        height="512"
        decoding="async"
        className={[
          "shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-slate-200",
          compact ? "h-10 w-10" : "h-12 w-12",
        ].join(" ")}
      />
      <div className="min-w-0 leading-tight">
        <p
          className={[
            "truncate font-display font-extrabold text-ink",
            compact ? "text-sm" : "text-base",
          ].join(" ")}
        >
          Rovauto Support
        </p>
        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          Customer operations
        </p>
      </div>
    </div>
  );
}
