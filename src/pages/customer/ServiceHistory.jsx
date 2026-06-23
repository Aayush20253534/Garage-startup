import { FiDownload, FiStar } from "react-icons/fi";

const HIST = [
  { id: "RV2102", svc: "AC Gas Refill & Service", garage: "Speed Motors", date: "02 May 2026", price: 2499, rating: 5 },
  { id: "RV1980", svc: "Express Car Wash", garage: "Prime Auto Hub", date: "18 Apr 2026", price: 299, rating: 4 },
  { id: "RV1875", svc: "Standard Service Package", garage: "AutoCare Premium", date: "10 Mar 2026", price: 3500, rating: 5 },
];

export default function ServiceHistory() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Service History</h2>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left">
            <tr>{["Booking", "Service", "Garage", "Date", "Amount", "Rating", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {HIST.map((h) => (
              <tr key={h.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium">#{h.id}</td>
                <td className="px-4 py-3">{h.svc}</td>
                <td className="px-4 py-3">{h.garage}</td>
                <td className="px-4 py-3">{h.date}</td>
                <td className="px-4 py-3 font-semibold">₹{h.price}</td>
                <td className="px-4 py-3 text-amber-500 flex items-center gap-0.5">{Array.from({ length: h.rating }).map((_, i) => <FiStar key={i} fill="currentColor" />)}</td>
                <td className="px-4 py-3"><button className="btn-ghost !py-1.5 !px-3 text-xs"><FiDownload /> Receipt</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
