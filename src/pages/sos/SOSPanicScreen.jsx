import { useNavigate } from "react-router-dom";
import { FiTrendingUp, FiCircle, FiTool, FiTruck } from "react-icons/fi";

const SOS_PROBLEMS = [
  { id: "flat-tire", icon: FiCircle, label: "Flat Tire", emoji: "🛞", desc: "Puncture repair" },
  { id: "dead-battery", icon: FiTrendingUp, label: "Dead Battery", emoji: "🔋", desc: "Jumpstart" },
  { id: "engine-failure", icon: FiTool, label: "Engine Won't Start", emoji: "⚙️", desc: "Engine issues" },
  { id: "towing", icon: FiTruck, label: "Need Towing", emoji: "🏗️", desc: "Vehicle tow" },
];

export default function SOSPanicScreen() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container-x py-10">
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🚨</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-red-500 mb-2">SOS Rescue</h1>
          <p className="text-gray-400">Select your problem to get instant help</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {SOS_PROBLEMS.map((p) => (
            <button
              key={p.id}
              onClick={() => nav(`/sos/location?problem=${p.id}`)}
              className="p-6 rounded-2xl bg-gray-800 border border-gray-700 hover:border-red-500 hover:bg-gray-750 transition-all text-left"
            >
              <div className="text-4xl mb-2">{p.emoji}</div>
              <h3 className="text-xl font-bold mb-1">{p.label}</h3>
              <p className="text-sm text-gray-400">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
