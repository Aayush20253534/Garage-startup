import { useState } from "react";
import { motion } from "framer-motion";
import {
  FiArrowRight,
  FiHome,
  FiUser,
  FiMail,
  FiFileText,
} from "react-icons/fi";

const COUNTRY_CODE = "+91";

const getPhoneDigits = (value) => {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 10);
};

export default function OnboardingStep1({ data, onChange, onNext }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);
    onNext();
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-soft">
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg card-soft p-8"
        >
          <h1 className="text-3xl font-bold mb-2">Garage Details</h1>
          <p className="text-muted mb-8">
            Let's start with your basic information
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">
                Garage Name
              </label>
              <div className="relative">
                <FiHome className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => onChange({ ...data, name: e.target.value })}
                  placeholder="Enter garage name"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Owner Name
              </label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={data.ownerName}
                  onChange={(e) =>
                    onChange({ ...data, ownerName: e.target.value })
                  }
                  placeholder="Enter owner name"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <div className="flex items-center overflow-hidden rounded-xl border border-line bg-white transition focus-within:border-ink">
                <div className="grid h-full w-16 shrink-0 place-items-center border-r border-line bg-bg-soft px-3 py-3 font-semibold text-ink">
                  {COUNTRY_CODE}
                </div>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={(e) =>
                    onChange({ ...data, phone: getPhoneDigits(e.target.value) })
                  }
                  maxLength={10}
                  inputMode="tel"
                  placeholder="Mobile number"
                  className="min-w-0 flex-1 border-0 px-4 py-3 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  value={data.email}
                  onChange={(e) => onChange({ ...data, email: e.target.value })}
                  placeholder="your@email.com"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                GST Number (Optional)
              </label>
              <div className="relative">
                <FiFileText className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={data.gst}
                  onChange={(e) => onChange({ ...data, gst: e.target.value })}
                  placeholder="29AAACB1234D1Z5"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 text-lg mt-4"
            >
              {loading ? "Continuing..." : "Continue"}
              <FiArrowRight className="w-5 h-5" />
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
