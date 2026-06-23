export default function Payments() {
  const items = [
    { id: "PAY9821", svc: "Standard Service Package", date: "12 Jun 2026", amount: 3549, method: "UPI" },
    { id: "PAY9610", svc: "AC Gas Service", date: "02 May 2026", amount: 2548, method: "Razorpay" },
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Payments</h2>
      <div className="card-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-soft text-left"><tr>{["Txn ID", "Service", "Date", "Method", "Amount"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{items.map((i) => (
            <tr key={i.id} className="border-t border-line">
              <td className="px-4 py-3 font-medium">{i.id}</td>
              <td className="px-4 py-3">{i.svc}</td>
              <td className="px-4 py-3">{i.date}</td>
              <td className="px-4 py-3">{i.method}</td>
              <td className="px-4 py-3 font-semibold">₹{i.amount}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
