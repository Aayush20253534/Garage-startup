export default function ComingSoonOverlay({ compact = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/20">
      <span
        className={`rounded-full border border-white/30 bg-black/75 font-bold uppercase tracking-[0.14em] text-white shadow-lg backdrop-blur ${
          compact ? "px-2.5 py-1 text-[10px]" : "px-4 py-2 text-xs"
        }`}
      >
        Coming Soon
      </span>
    </div>
  );
}
