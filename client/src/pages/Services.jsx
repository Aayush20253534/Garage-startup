import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_UI } from "@/data/services";
import { FiSearch, FiArrowRight, FiSettings } from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function Services() {
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const { cart, fetchServiceCategories } = useApp();
  const cartItems = Array.isArray(cart) ? cart : [];

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchServiceCategories();
        setCategories(data || []);
      } catch (error) {
        console.error("Failed to load service categories:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [fetchServiceCategories]);

  const filteredCategories = (
    q
      ? categories.filter((category) =>
          category.name.toLowerCase().includes(q.toLowerCase()),
        )
      : categories
  ).filter(
    (category) =>
      ![
        "Brake",
        "Cleaning",
        "Electrical",
        "Emergency",
        "Engine",
        "General Service",
        "Tyre",
        "Tyres",
        "Battery",
        "AC",
      ].includes(category.name),
  );

  const cartTotal = cartItems.reduce((total, item) => {
    return total + (item.basePrice || item.minPrice || item.price || 0);
  }, 0);

  return (
    <div className="container-x py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">All Services</h1>
          <p className="mt-2 text-muted">
            Curated for your vehicle. Transparent pricing.
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />

          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search categories"
            className="w-full rounded-full border border-line py-3 pl-11 pr-4 outline-none focus:border-[#b9f000]"
          />
        </div>
      </div>

      {loading ? (
        <div className="card-soft p-8 text-muted">Loading services...</div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
          {filteredCategories.map((category) => {
            const ui = CATEGORY_UI[category.name] || {};
            const Icon = ui.icon || FiSettings;

            return (
              <Link
                to={ui.isSos ? "/sos" : `/services/${category.id}`}
                key={category.id}
                className="flex h-[250px] cursor-pointer flex-col overflow-hidden rounded-3xl bg-white p-4 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl sm:h-auto sm:p-5"
              >
                <div className="mb-3 min-h-[52px] text-xl font-bold leading-tight sm:mb-4 sm:min-h-0">
                  {category.name}
                </div>

                <div className="mt-auto h-32 w-full overflow-hidden rounded-2xl bg-bg-soft">
                  {ui.image ? (
                    <img
                      src={ui.image}
                      alt={category.name}
                      className="h-full w-full object-cover transition-transform hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-3xl text-muted">
                      <Icon />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}

          {filteredCategories.length === 0 && (
            <div className="card-soft p-8 text-muted">
              No service categories found.
            </div>
          )}
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <Link to="/checkout" className="btn-dark px-6 py-3.5 shadow-2xl">
            {cartItems.length} service{cartItems.length > 1 ? "s" : ""} - Rs.{" "}
            {cartTotal} - Continue <FiArrowRight />
          </Link>
        </div>
      )}
    </div>
  );
}
