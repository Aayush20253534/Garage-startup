import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiLoader,
  FiMapPin,
  FiNavigation,
  FiSearch,
} from "react-icons/fi";
import { mapsApi } from "@/api/maps";
import {
  getAddressLineFromPlace,
  reverseGeocodeCoordinates,
} from "@/utils/address";
import { UNAVAILABLE_CITY_MESSAGE, requireAvailableCityName } from "@/utils/cityAvailability";
import CustomerLoginLoader from "@/components/auth/CustomerLoginLoader";
import MapPanel from "./MapPanel";

const createSessionToken = () =>
  globalThis.crypto?.randomUUID?.() ||
  `rovauto-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getDisplayValue = (value = {}) =>
  value.formattedAddress ||
  value.fullAddress ||
  value.address ||
  "";

export default function LocationPicker({
  value = {},
  onChange,
  onUnsupportedCurrentLocation,
  label = "Search address",
  helper = "Search, select, then drag the pin to the exact entrance.",
  dark = false,
  required = false,
  showCurrentLocation = false,
}) {
  const [query, setQuery] = useState(() => getDisplayValue(value));
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const sessionTokenRef = useRef(createSessionToken());
  const selectedTextRef = useRef(getDisplayValue(value));
  const autocompleteRequestRef = useRef(0);

  const coordinate = useMemo(() => {
    const latitude = Number(value.latitude ?? value.lat);
    const longitude = Number(value.longitude ?? value.lng);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  }, [value.latitude, value.longitude, value.lat, value.lng]);

  const attachAvailableCity = async (location) => {
    const city = await requireAvailableCityName(location);
    return {
      ...location,
      city,
    };
  };

  useEffect(() => {
    const next = getDisplayValue(value);

    if (!next) {
      selectedTextRef.current = "";
      setQuery("");
      return;
    }

    if (next === query) {
      return;
    }

    selectedTextRef.current = next;
    setQuery(next);
  }, [value.formattedAddress, value.fullAddress, value.address, query]);

  useEffect(() => {
    const clean = query.trim();
    if (!focused || clean.length < 3 || clean === selectedTextRef.current) {
      autocompleteRequestRef.current += 1;
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      const requestId = autocompleteRequestRef.current + 1;
      autocompleteRequestRef.current = requestId;
      setSearching(true);
      setError("");
      try {
        const results = await mapsApi.autocomplete({
          input: clean,
          sessionToken: sessionTokenRef.current,
          latitude: coordinate?.latitude,
          longitude: coordinate?.longitude,
        });
        if (autocompleteRequestRef.current === requestId) {
          setSuggestions(Array.isArray(results) ? results : []);
        }
      } catch (err) {
        if (autocompleteRequestRef.current === requestId) {
          setSuggestions([]);
          setError(err.response?.data?.message || err.message || "Address search failed");
        }
      } finally {
        if (autocompleteRequestRef.current === requestId) {
          setSearching(false);
        }
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [query, focused, coordinate?.latitude, coordinate?.longitude]);

  const chooseSuggestion = async (suggestion) => {
    setSelecting(true);
    setError("");
    try {
      const place = await mapsApi.getPlaceDetails(
        suggestion.placeId,
        sessionTokenRef.current,
      );
      const structuredAddress =
        place.address && typeof place.address === "object" ? place.address : {};
      const address = getAddressLineFromPlace({
        address: structuredAddress.address,
        formattedAddress: place.formattedAddress,
        displayName: place.displayName,
        fallback: suggestion.mainText || suggestion.text,
        structuredAddress,
      });
      const next = await attachAvailableCity({
        ...structuredAddress,
        address,
        formattedAddress: place.formattedAddress,
        fullAddress: place.formattedAddress,
        latitude: place.latitude,
        longitude: place.longitude,
        placeId: place.placeId,
        addressComponents: place.addressComponents,
        source: "MANUAL",
      });
      selectedTextRef.current = place.formattedAddress;
      setQuery(place.formattedAddress);
      setSuggestions([]);
      setFocused(false);
      sessionTokenRef.current = createSessionToken();
      onChange?.(next);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load this address");
    } finally {
      setSelecting(false);
    }
  };

  const resolveDraggedLocation = async (
    nextCoordinate,
    source = "MANUAL",
    options = {},
  ) => {
    setSelecting(true);
    setError("");
    let parsed = null;
    try {
      parsed = await reverseGeocodeCoordinates(nextCoordinate);
      const formattedAddress = parsed.fullAddress || parsed.displayName || parsed.address || query;
      const next = await attachAvailableCity({
        ...value,
        ...parsed,
        formattedAddress,
        fullAddress: formattedAddress,
        latitude: nextCoordinate.latitude,
        longitude: nextCoordinate.longitude,
        placeId: parsed.placeId || value.placeId || null,
        addressComponents: parsed.addressComponents || value.addressComponents || null,
        source,
      });
      selectedTextRef.current = formattedAddress;
      setQuery(formattedAddress);
      onChange?.(next);
      return next;
    } catch (err) {
      const nextError = err.response?.data?.message || err.message || "Could not resolve this pin location";
      if (!options.silentError) {
        setError(nextError);
      }
      if (options.throwOnError) {
        if (parsed && typeof err === "object" && err) {
          err.locationContext = {
            ...parsed,
            latitude: nextCoordinate.latitude,
            longitude: nextCoordinate.longitude,
            source,
          };
        }
        throw err;
      }
      return null;
    } finally {
      setSelecting(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Current location is not supported by this browser");
      return;
    }

    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinate = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };

        try {
          await resolveDraggedLocation(coordinate, "GPS", {
            silentError: true,
            throwOnError: true,
          });
        } catch (err) {
          const nextError = err.response?.data?.message || err.message || "Unable to access current location";
          if (nextError === UNAVAILABLE_CITY_MESSAGE && typeof onUnsupportedCurrentLocation === "function") {
            onUnsupportedCurrentLocation({
              message: nextError,
              coordinate,
              ...(err.locationContext || {}),
            });
          } else {
            setError(nextError);
          }
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.message || "Unable to access current location");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <>
      <CustomerLoginLoader
        visible={locating}
        eyebrow="ROVAUTO LOCATION"
        title="Finding your location"
        message="Using GPS to place you in the correct service area."
      />
      <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <label
            className={`text-sm font-semibold ${dark ? "text-white" : "text-ink"}`}
          >
            {label}
          </label>
          <p className={`mt-1 text-xs leading-5 ${dark ? "text-gray-400" : "text-muted"}`}>
            {helper}
          </p>
        </div>
        {coordinate && (
          <div
            className={`inline-flex shrink-0 items-center gap-2.5 self-start border-l-[3px] px-3 py-2 text-left ${
              dark
                ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                : "border-emerald-600 bg-emerald-50 text-emerald-800"
            }`}
          >
            <FiCheckCircle className="shrink-0 text-base" />
            <span>
              <span className="block text-xs font-extrabold leading-4">
                Location confirmed
              </span>
              <span
                className={`block text-[10px] font-medium leading-4 ${
                  dark ? "text-emerald-200/70" : "text-emerald-700/75"
                }`}
              >
                Pin ready for service
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="relative">
        <FiSearch
          className={`absolute left-4 top-1/2 z-10 -translate-y-1/2 ${
            dark ? "text-gray-400" : "text-muted"
          }`}
        />
        <input
          required={required}
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            selectedTextRef.current = "";
            onChange?.({
              ...value,
              address: next,
              formattedAddress: next,
              fullAddress: next,
              latitude: null,
              longitude: null,
              placeId: null,
              addressComponents: null,
            });
          }}
          placeholder="Search house, street, landmark, or area"
          className={`w-full rounded-lg border py-3.5 pl-11 pr-12 text-sm outline-none transition ${
            dark
              ? "border-gray-700 bg-gray-900 text-white placeholder:text-gray-500 focus:border-yellow-400"
              : "border-line bg-white text-ink focus:border-ink"
          }`}
        />
        {(searching || selecting) && (
          <FiLoader className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-muted" />
        )}

        {focused && suggestions.length > 0 && (
          <div
            className={`absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border p-2 shadow-2xl ${
              dark
                ? "border-gray-700 bg-gray-900"
                : "border-line bg-white"
            }`}
          >
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(suggestion)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                  dark ? "hover:bg-gray-800" : "hover:bg-bg-soft"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    dark ? "bg-gray-800 text-yellow-300" : "bg-brand/25 text-ink"
                  }`}
                >
                  <FiMapPin />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-semibold ${
                      dark ? "text-white" : "text-ink"
                    }`}
                  >
                    {suggestion.mainText || suggestion.text}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs ${
                      dark ? "text-gray-400" : "text-muted"
                    }`}
                  >
                    {suggestion.secondaryText}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCurrentLocation && (
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating || selecting}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold transition disabled:opacity-60 ${
            dark
              ? "border-gray-700 bg-gray-800 text-white hover:border-yellow-400"
              : "border-line bg-white text-ink hover:border-ink"
          }`}
        >
          <FiNavigation />
          {locating ? "Finding your exact location…" : "Use current GPS location"}
        </button>
      )}

      {error && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            dark
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      <div className={`flex items-center justify-end text-[11px] font-medium ${
        dark ? "text-gray-500" : "text-muted"
      }`}>
        Powered by Google
      </div>

      {coordinate && (
        <MapPanel
          center={coordinate}
          draggable
          onLocationChange={resolveDraggedLocation}
          dark={dark}
          height={320}
        />
      )}
      </div>
    </>
  );
}
