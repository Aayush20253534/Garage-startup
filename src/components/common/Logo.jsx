import { LOGO_URL } from "@/data/vehicles";

export default function Logo({ className = "h-17 w-auto mt-0", showText = true }) {
  return (
    <div className="flex items-center gap-2">
      <img src={LOGO_URL} alt="Rovauto" className={className} />
      {showText && (
        <div className="hidden sm:flex flex-col leading-none">
          <span className="font-display font-extrabold text-lg tracking-tight text-ink">Rovauto</span>
          <span className="text-[10px] text-muted -mt-0.5">Gaadi Apki, Guarantee Hamari</span>
        </div>
      )}
    </div>
  );
}
