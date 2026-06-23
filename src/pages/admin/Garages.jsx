const G = [
  { n: "AutoCare Premium", c: "Ghaziabad", r: 4.9, j: 284, s: "Verified" },
  { n: "Speed Motors", c: "Pune", r: 4.8, j: 219, s: "Verified" },
  { n: "Prime Auto Hub", c: "Noida", r: 4.7, j: 198, s: "Verified" },
  { n: "FastFix Garage", c: "Bengaluru", r: 4.2, j: 64, s: "Pending" },
];
export default function Garages() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Garages</h2>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left"><tr>{["Garage","City","Rating","Jobs","Status",""].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{G.map(r => <tr key={r.n} className="border-t border-line">
            <td className="px-4 py-3 font-medium">{r.n}</td><td className="px-4 py-3">{r.c}</td><td className="px-4 py-3">{r.r}★</td><td className="px-4 py-3">{r.j}</td>
            <td className="px-4 py-3">{r.s === "Verified" ? <span className="chip-brand">{r.s}</span> : <span className="chip">{r.s}</span>}</td>
            <td className="px-4 py-3"><button className="btn-ghost !py-1.5 !px-3 text-xs">View</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
