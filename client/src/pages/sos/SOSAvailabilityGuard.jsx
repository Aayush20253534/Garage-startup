import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/axios";
import { CATEGORY_UI } from "@/data/services";
import ComingSoonOverlay from "@/components/services/ComingSoonOverlay";
import { getCategoryThumbnailUrl } from "@/utils/imageCache";
import { FiArrowLeft, FiTool } from "react-icons/fi";

export default function SOSAvailabilityGuard({
  children,
}) {
  const [loading, setLoading] = useState(true);
  const [sosCategory, setSosCategory] =
    useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkAvailability = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await api.get(
          "/services/categories",
        );

        const categories =
          response.data?.data || [];

        const found = categories.find(
          (category) =>
            CATEGORY_UI[category.name]?.isSos,
        );

        if (mounted) {
          setSosCategory(found || null);
        }
      } catch (err) {
        console.error(
          "Unable to check SOS availability:",
          err,
        );

        if (mounted) {
          setError(
            "Unable to check roadside assistance availability.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container-x py-16 text-center">
          Checking roadside assistance...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 px-4 py-16 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-gray-800 p-6 text-center">
          <p className="text-red-300">
            {error}
          </p>

          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-gray-900"
          >
            <FiArrowLeft />
            Back Home
          </Link>
        </div>
      </div>
    );
  }

  const comingSoon =
    sosCategory?.isComingSoon === true;

  if (!comingSoon) {
    return children;
  }

  const image =
    getCategoryThumbnailUrl(sosCategory);

  return (
    <div className="min-h-screen bg-gray-900 px-4 py-12 text-white">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-3xl border border-gray-700 bg-gray-800 shadow-2xl">
          <div className="relative h-64 overflow-hidden bg-gray-950">
            {image ? (
              <img
                src={image}
                alt={sosCategory.name}
                className="h-full w-full scale-105 object-cover blur-sm grayscale"
              />
            ) : (
              <div className="grid h-full place-items-center text-6xl text-gray-500">
                <FiTool />
              </div>
            )}

            <ComingSoonOverlay />
          </div>

          <div className="p-6 text-center sm:p-8">
            <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
              Coming Soon
            </span>

            <h1 className="mt-4 text-3xl font-extrabold">
              Roadside Assistance
            </h1>

            <p className="mt-3 leading-7 text-gray-400">
              Emergency roadside assistance is
              currently being prepared. It will be
              available soon through verified
              mechanics and towing partners.
            </p>

            <Link
              to="/"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-gray-900 transition hover:bg-gray-100"
            >
              <FiArrowLeft />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}