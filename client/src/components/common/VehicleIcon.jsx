const PREMIUM_BRANDS = new Set([
  "audi",
  "bmw",
  "jaguar",
  "land rover",
  "mercedes",
  "mercedes-benz",
  "volvo",
]);

const SUV_HINTS = [
  "brezza",
  "compass",
  "creta",
  "defender",
  "discovery",
  "duster",
  "ecosport",
  "endeavour",
  "evoque",
  "fortuner",
  "gloster",
  "hector",
  "kiger",
  "kodiaq",
  "kushaq",
  "magnite",
  "meridian",
  "nexon",
  "range rover",
  "safari",
  "scorpio",
  "sonet",
  "taigun",
  "thar",
  "venue",
  "wrangler",
  "x-trail",
  "x1",
  "x3",
  "x5",
  "x7",
  "xc40",
  "xc60",
  "xc90",
];

const HATCHBACK_HINTS = [
  "alto",
  "baleno",
  "celerio",
  "comet",
  "figo",
  "glanza",
  "go",
  "golf",
  "i10",
  "i20",
  "ignis",
  "kwid",
  "polo",
  "redi-go",
  "swift",
  "tiago",
  "wagon",
];

const EV_HINTS = ["ev", "electric", "comet", "nexon ev", "zs ev"];

const normalize = (value = "") => String(value).trim().toLowerCase();

const includesAny = (value, hints) => hints.some((hint) => value.includes(hint));

const getInitials = (brand = "") => {
  const words = String(brand).trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return String(brand).trim().slice(0, 2).toUpperCase() || "CA";
};

const getVehicleVariant = ({ brand = "", model = "", fuelType = "", fuel = "" }) => {
  const brandKey = normalize(brand);
  const modelKey = normalize(model);
  const fuelKey = normalize(fuelType || fuel);
  const combined = `${brandKey} ${modelKey} ${fuelKey}`;

  if (includesAny(combined, EV_HINTS)) return "ev";
  if (includesAny(modelKey, SUV_HINTS)) return "suv";
  if (includesAny(modelKey, HATCHBACK_HINTS)) return "hatchback";
  if (PREMIUM_BRANDS.has(brandKey)) return "premium";
  return "sedan";
};

const BODY_PATHS = {
  hatchback:
    "M13 40h5l5-11h25l13 11h8c4 0 7 3 7 7v8H8v-8c0-4 2-7 5-7Zm13-2h25l-7-6H29l-3 6Z",
  sedan:
    "M10 42h9l8-11h28l10 11h9c4 0 7 3 7 7v6H7v-6c0-4 3-7 7-7Zm18-4h29l-7-5H32l-4 5Z",
  suv: "M9 39h8l6-12h35l12 12h7c4 0 7 3 7 7v9H6v-9c0-4 2-7 7-7Zm17-3h33l-7-6H30l-4 6Z",
  premium:
    "M8 43h12l11-12h27l13 12h11c3 0 6 3 6 6v6H6v-6c0-3 2-6 6-6Zm25-5h25l-6-5H38l-5 5Z",
  ev: "M10 41h8l8-11h30l11 11h8c4 0 7 3 7 7v7H7v-7c0-4 3-7 7-7Zm18-4h29l-7-5H32l-4 5Z",
};

export default function VehicleIcon({
  vehicle,
  brand,
  model,
  fuelType,
  fuel,
  className = "h-8 w-8",
}) {
  const details = {
    brand: brand ?? vehicle?.brand,
    model: model ?? vehicle?.model,
    fuelType: fuelType ?? vehicle?.fuelType,
    fuel: fuel ?? vehicle?.fuel,
  };
  const variant = getVehicleVariant(details);
  const initials = getInitials(details.brand);
  const isEv = variant === "ev";

  return (
    <svg
      viewBox="0 0 96 72"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
    >
      <path
        d={BODY_PATHS[variant]}
        fill="currentColor"
        fillOpacity="0.96"
      />
      <path
        d="M23 55a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM70 55a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z"
        fill="#fff"
        fillOpacity="0.96"
      />
      <path
        d="M23 51a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM70 51a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="currentColor"
      />
      <text
        x="48"
        y="50"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill="#fff"
        fontFamily="Inter, Arial, sans-serif"
      >
        {initials}
      </text>
      {isEv && (
        <path
          d="M58 18h8l-6 10h7L54 45l4-13h-7l7-14Z"
          fill="#b9f000"
        />
      )}
    </svg>
  );
}
