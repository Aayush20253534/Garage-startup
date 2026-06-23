const B = [
  { id: "RV2384", c: "Ayush Kumar", g: "AutoCare Premium", s: "In Progress", a: 3549 },
  { id: "RV2383", c: "Priya Sharma", g: "Speed Motors", s: "Completed", a: 2548 },
  { id: "RV2382", c: "Rahul Mehta", g: "Prime Auto Hub", s: "Assigning", a: 1899 },
];
export default function Bookings() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Bookings</h2>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left"><tr>{["Booking","Customer","Garage","Status","Amount"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{B.map(r => <tr key={r.id} className="border-t border-line">
            <td className="px-4 py-3 font-medium">#{r.id}</td><td className="px-4 py-3">{r.c}</td><td className="px-4 py-3">{r.g}</td>
            <td className="px-4 py-3"><span className="chip-brand">{r.s}</span></td><td className="px-4 py-3 font-semibold">₹{r.a}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
