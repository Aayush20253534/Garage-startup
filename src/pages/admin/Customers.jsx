const C = [
  { n: "Ayush Kumar", p: "+91 98xxx xxx12", c: "Ghaziabad", b: 7, s: "Active" },
  { n: "Priya Sharma", p: "+91 98xxx xxx33", c: "Noida", b: 4, s: "Active" },
  { n: "Rahul Mehta", p: "+91 98xxx xxx91", c: "Delhi", b: 12, s: "Active" },
  { n: "Neha Singh", p: "+91 98xxx xxx55", c: "Gurugram", b: 2, s: "New" },
];
export default function Customers() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Customers</h2>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left"><tr>{["Name","Phone","City","Bookings","Status"].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{C.map(r => <tr key={r.p} className="border-t border-line">
            <td className="px-4 py-3 font-medium">{r.n}</td><td className="px-4 py-3">{r.p}</td><td className="px-4 py-3">{r.c}</td><td className="px-4 py-3">{r.b}</td>
            <td className="px-4 py-3"><span className="chip-brand">{r.s}</span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
