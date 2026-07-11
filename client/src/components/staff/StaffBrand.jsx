const PORTAL_BRAND = {
  admin: {
    name: "Rovauto Admin",
    caption: "Platform operations",
    icon: "/admin-icon-512.png",
  },
  intern: {
    name: "Rovauto Intern",
    caption: "Operations workspace",
    icon: "/intern-icon-512.png",
  },
};

export default function StaffBrand({ portal = "admin", compact = false, className = "" }) {
  const brand = PORTAL_BRAND[portal] || PORTAL_BRAND.admin;

  return (
    <div className={["flex min-w-0 items-center gap-3", className].join(" ")}>
      <img
        src={brand.icon}
        alt={brand.name}
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
          {brand.name}
        </p>
        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
          {brand.caption}
        </p>
      </div>
    </div>
  );
}
