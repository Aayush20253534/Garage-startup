import { Link } from "react-router-dom";

export default function ActiveBookings() {
  const items = [
    { id: "RV2384", svc: "Standard Service Package", garage: "AutoCare Premium", status: "In Progress", price: 3500 },
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Active Bookings</h2>
      <div className="grid gap-4">
        {items.map((b) => (
          <div key={b.id} className="card-soft p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted">#{b.id}</div>
              <div className="font-semibold">{b.svc}</div>
              <div className="text-sm text-muted">{b.garage}</div>
            </div>
            <span className="chip-brand">{b.status}</span>
            <div className="font-bold">₹{b.price}</div>
            <Link to="/tracking" className="btn-dark">Track</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
