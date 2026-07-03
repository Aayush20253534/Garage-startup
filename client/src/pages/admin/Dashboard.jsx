import { useEffect, useState } from "react";
import { FiCalendar, FiDollarSign, FiHome, FiUsers } from "react-icons/fi";
import { adminApi } from "@/api/admin";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    garages: 0,
    activeGarages: 0,
    pendingApplications: 0,
    priceRanges: 0,
    customers: 0,
    bookings: 0,
  });

  const [recentApplications, setRecentApplications] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");

      try {
        const [
          garages,
          pendingApplications,
          priceRanges,
          customers,
          bookings,
        ] = await Promise.all([
          adminApi.getGarages(),
          adminApi.getApplications("PENDING"),
          adminApi.getPriceRanges(),
          adminApi.getCustomers(),
          adminApi.getBookings(),
        ]);

        setStats({
          garages: garages?.length || 0,
          activeGarages:
            garages?.filter((garage) => garage.isActive)?.length || 0,
          pendingApplications: pendingApplications?.length || 0,
          priceRanges: priceRanges?.length || 0,
          customers: customers?.length || 0,
          bookings: bookings?.length || 0,
        });

        setRecentApplications((pendingApplications || []).slice(0, 5));
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to load admin dashboard"
        );
      }
    };

    load();
  }, []);

  const cards = [
    {
      icon: FiHome,
      n: stats.garages,
      l: "Total Garages",
      c: `${stats.activeGarages} active`,
    },
    {
      icon: FiCalendar,
      n: stats.pendingApplications,
      l: "Pending Applications",
      c: "Needs review",
    },
    {
      icon: FiDollarSign,
      n: stats.priceRanges,
      l: "Price Ranges",
      c: "Configured",
    },
    {
      icon: FiUsers,
      n: stats.customers,
      l: "Customers",
      c: `${stats.bookings} bookings`,
    },
  ];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="grid gap-5 sm:gap-6">
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((s) => {
            const Icon = s.icon;

            return (
              <div key={s.l} className="card-soft min-w-0 p-4 sm:p-5">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand">
                    <Icon />
                  </div>

                  <span className="chip-brand max-w-[140px] truncate">
                    {s.c}
                  </span>
                </div>

                <div className="mt-3 text-2xl font-bold">{s.n}</div>
                <div className="truncate text-sm text-muted">{s.l}</div>
              </div>
            );
          })}
        </div>

        <div className="card-soft w-full max-w-full overflow-hidden">
          <div className="border-b border-line p-4 sm:p-5">
            <h3 className="font-semibold">Pending Garage Applications</h3>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-bg-soft text-left">
                <tr>
                  {["Garage", "Owner", "City", "Phone", "Created"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {recentApplications.length ? (
                  recentApplications.map((application) => (
                    <tr key={application.id} className="border-t border-line">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {application.garageName || "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {application.ownerName || "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {application.city || "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {application.phone || "-"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        {application.createdAt
                          ? new Date(application.createdAt).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-5 text-muted">
                      No pending applications.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}