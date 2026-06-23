export default function Earnings() {
  const monthly = [
    { m: "Jan", v: 32 }, { m: "Feb", v: 41 }, { m: "Mar", v: 38 }, { m: "Apr", v: 52 }, { m: "May", v: 47 }, { m: "Jun", v: 48 },
  ];
  const max = Math.max(...monthly.map(x => x.v));
  return (
    <div className="grid gap-6">
      <div className="grid sm:grid-cols-3 gap-4">
        {[["₹48,200", "This month"], ["₹2.84L", "This quarter"], ["₹5.62L", "YTD"]].map(([n, l]) => (
          <div key={l} className="card-soft p-5"><div className="text-3xl font-bold">{n}</div><div className="text-sm text-muted mt-1">{l}</div></div>
        ))}
      </div>
      <div className="card-soft p-6">
        <h3 className="font-semibold mb-4">Monthly earnings (₹K)</h3>
        <div className="flex items-end gap-3 h-56">
          {monthly.map((d) => (
            <div key={d.m} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-t-xl bg-brand" style={{ height: `${(d.v/max)*100}%` }} />
              <div className="text-xs text-muted">{d.m}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
