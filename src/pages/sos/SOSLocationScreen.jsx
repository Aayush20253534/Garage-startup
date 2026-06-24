import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiNavigation, FiMapPin } from "react-icons/fi";

export default function SOSLocationScreen() {
  const [searchParams] = useSearchParams();
  const problem = searchParams.get("problem");
  const nav = useNavigate();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const useCurrentLocation = () => {
    setLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLoading(false);
          nav(`/sos/checkout?problem=${problem}`);
        },
        () => {
          setLoading(false);
          alert("Unable to get location");
        }
      );
    } else {
      alert("Geolocation not supported");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container-x py-10">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">📍</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-2">Where are you stuck?</h1>
          <p className="text-gray-400">Use GPS for fastest help</p>
        </div>
        <div className="max-w-md mx-auto space-y-4">
          <button
            onClick={useCurrentLocation}
            disabled={loading}
            className="w-full p-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-3 font-bold text-lg transition-all disabled:opacity-50"
          >
            <FiNavigation className="text-2xl" />
            {loading ? "Getting location..." : "Use Current Location"}
          </button>
          <button
            onClick={() => nav(`/sos/checkout?problem=${problem}`)}
            className="w-full p-5 rounded-2xl bg-gray-800 border border-gray-700 text-white flex items-center justify-center gap-3 font-semibold"
          >
            <FiMapPin className="text-xl" />
            Enter Address Manually
          </button>
        </div>
      </div>
    </div>
  );
}
