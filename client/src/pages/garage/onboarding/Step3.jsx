import { useState } from "react";
import { motion } from "framer-motion";
import { FiArrowRight, FiArrowLeft } from "react-icons/fi";
import ImageUpload from "@/components/garage/ImageUpload";

export default function OnboardingStep3({ data, onChange, onNext, onBack }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (data.images.length < 10) {
      setError("Upload at least 10 garage photos before continuing.");
      return;
    }

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
          className="w-full max-w-2xl card-soft p-8"
        >
          <h1 className="text-3xl font-bold mb-2">Garage Images</h1>
          <p className="text-muted mb-8">
            Upload 10 to 15 garage photos. Each photo must be 1 MB or less.
          </p>
          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <ImageUpload
              min={10}
              max={15}
              maxSizeMb={1}
              value={data.images}
              onChange={(images) => onChange({ ...data, images })}
            />

            <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
              <button
                type="button"
                onClick={onBack}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:border-ink/25 hover:bg-bg-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black shadow-sm shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Continuing..." : "Continue"}
                <FiArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
