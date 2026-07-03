import { useEffect, useState } from "react";
import { cityApi } from "@/api/cities";
import { loadActiveCities } from "@/utils/cityAvailability";

export default function CitySelect({
  value,
  onChange,
  required = false,
  placeholder = "Select city",
  includeInactive = false,
  className = "",
}) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = includeInactive
          ? await cityApi.getAdminCities({ includeInactive: true })
          : await loadActiveCities();
        if (!mounted) return;
        setCities(data || []);
      } catch {
        if (mounted) setCities([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [includeInactive]);

  return (
    <select
      required={required}
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      className={className || "min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"}
    >
      <option value="">{loading ? "Loading cities..." : placeholder}</option>
      {value && !cities.some((city) => city.name.toLowerCase() === String(value).toLowerCase()) && (
        <option value={value}>{value} (Unavailable)</option>
      )}
      {cities.map((city) => (
        <option key={city.id} value={city.name}>
          {city.name}{city.state ? `, ${city.state}` : ""}{city.isActive === false ? " (Inactive)" : ""}
        </option>
      ))}
    </select>
  );
}
