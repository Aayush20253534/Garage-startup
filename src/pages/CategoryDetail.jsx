import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { SERVICE_CATEGORIES, CATEGORY_PACKAGES } from "@/data/services";
import { FiStar, FiArrowLeft, FiX } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const category = SERVICE_CATEGORIES.find(c => c.id === categoryId);
  const packages = CATEGORY_PACKAGES[categoryId] || [];
  const { user, addToCart } = useApp();
  const nav = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState(null);

  if (!category) {
    return <div className="container-x py-10">Category not found</div>;
  }

  return (
    <div className="container-x py-10">
      {/* Back button */}
      <Link to="/services" className="flex items-center gap-2 text-ink mb-6 hover:opacity-80">
        <FiArrowLeft /> Back to Services
      </Link>

      <h1 className="text-3xl sm:text-4xl font-bold mb-8">{category.name}</h1>

      <div className="grid gap-6">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-white rounded-3xl p-6 shadow-lg">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Package Image */}
              <div className="h-52 w-full md:w-72 rounded-3xl overflow-hidden flex-shrink-0">
                <img src={pkg.image} alt={pkg.name} className="h-full w-full object-cover" />
              </div>

              {/* Package Details */}
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">{pkg.name}</h2>

                {/* Price & Discount */}
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="text-2xl sm:text-3xl font-bold text-ink">₹{pkg.price}</span>
                  <span className="text-xl text-muted line-through">₹{pkg.originalPrice}</span>
                  <span className="text-green-600 font-bold text-xl">{pkg.discount}</span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1">
                    <FiStar className="text-amber-400" fill="currentColor" />
                    <span className="text-xl font-semibold">{pkg.rating}</span>
                  </div>
                  <span className="text-muted text-lg">({pkg.totalRatings} ratings)</span>
                </div>

                {/* Bookings badge */}
                <div className="inline-block bg-yellow-100 text-yellow-800 px-4 py-2 rounded-xl text-lg font-medium mb-4">
                  {pkg.bookings}
                </div>

                {/* Key Details */}
                <ul className="space-y-2 mb-6">
                  <li className="flex items-start gap-3 text-xl">
                    <span className="font-bold text-ink">Time:</span>
                    <span className="text-muted">{pkg.time}</span>
                  </li>
                  <li className="flex items-start gap-3 text-xl">
                    <span className="font-bold text-ink">Warranty:</span>
                    <span className="text-muted">{pkg.warranty}</span>
                  </li>
                  <li className="flex items-start gap-3 text-xl">
                    <span className="font-bold text-ink">Service Interval:</span>
                    <span className="text-muted">{pkg.serviceInterval}</span>
                  </li>
                  <li className="flex items-start gap-3 text-xl">
                    <span className="font-bold text-ink">Services:</span>
                    <span className="text-muted">{pkg.servicesIncluded} included</span>
                  </li>
                </ul>

                {/* Divider */}
                <div className="border-t-2 border-dashed border-gray-200 my-6"></div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setSelectedPackage(pkg)}
                    className="flex-1 py-5 px-8 rounded-3xl border-2 border-gray-300 text-2xl font-bold hover:bg-gray-50 transition"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      const serviceItem = { id: pkg.id, name: pkg.name, price: pkg.price, image: pkg.image, catId: categoryId };
                      addToCart(serviceItem);
                      if (!user) {
                        nav("/login");
                      } else {
                        nav("/booking/services");
                      }
                    }}
                    className="flex-1 py-5 px-8 rounded-3xl bg-[#b9f000] text-2xl font-bold hover:bg-[#9bd000] transition shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)]"
                  >
                    Book
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{selectedPackage.name}</h2>
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="grid place-items-center h-10 w-10 rounded-full border border-gray-300 hover:bg-gray-100 transition"
                >
                  <FiX />
                </button>
              </div>

              {/* Image */}
              <div className="h-56 w-full rounded-2xl overflow-hidden mb-6">
                <img
                  src={selectedPackage.image}
                  alt={selectedPackage.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-ink">₹{selectedPackage.price}</span>
                <span className="text-xl text-muted line-through">₹{selectedPackage.originalPrice}</span>
                <span className="text-green-600 font-bold text-xl">{selectedPackage.discount}</span>
              </div>

              {/* Rating & Bookings */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <FiStar className="text-amber-400" fill="currentColor" />
                  <span className="text-lg font-semibold">{selectedPackage.rating}</span>
                  <span className="text-muted text-sm">({selectedPackage.totalRatings} ratings)</span>
                </div>
                <div className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-xl text-sm font-medium">
                  {selectedPackage.bookings}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="text-sm text-muted">Time</span>
                  <div className="font-semibold text-lg">{selectedPackage.time}</div>
                </div>
                <div>
                  <span className="text-sm text-muted">Warranty</span>
                  <div className="font-semibold text-lg">{selectedPackage.warranty}</div>
                </div>
                <div>
                  <span className="text-sm text-muted">Service Interval</span>
                  <div className="font-semibold text-lg">{selectedPackage.serviceInterval}</div>
                </div>
                <div>
                  <span className="text-sm text-muted">Services Included</span>
                  <div className="font-semibold text-lg">{selectedPackage.servicesIncluded}</div>
                </div>
              </div>

              {/* Included Services */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3">Included Services</h3>
                <ul className="grid gap-2">
                  {selectedPackage.includes.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 py-2 px-4 bg-bg-soft rounded-xl">
                      <span className="h-2 w-2 rounded-full bg-brand" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="flex-1 py-3 px-6 rounded-full border-2 border-gray-300 font-bold hover:bg-gray-50 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const serviceItem = {
                      id: selectedPackage.id,
                      name: selectedPackage.name,
                      price: selectedPackage.price,
                      image: selectedPackage.image,
                      catId: categoryId,
                    };
                    addToCart(serviceItem);
                    setSelectedPackage(null);
                    if (!user) {
                      nav("/login");
                    } else {
                      nav("/booking/services");
                    }
                  }}
                  className="flex-1 py-3 px-6 rounded-full bg-[#b9f000] font-bold hover:bg-[#9bd000] transition shadow-[0_10px_40px_-10px_rgba(185,240,0,0.55)]"
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}