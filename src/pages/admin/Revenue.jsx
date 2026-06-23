export default function Revenue() {
  const data = [42, 56, 49, 68, 73, 81, 77, 85, 92, 98, 105, 118];
  const max = Math.max(...data);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div className="grid gap-6">
      <div className="grid sm:grid-cols-4 gap-4">
        {[["₹2.4Cr", "This month"], ["₹6.8Cr", "This quarter"], ["₹14.2Cr", "YTD"], ["+32%", "MoM growth"]].map(([n, l]) => (
          <div key={l} className="card-soft p-5"><div className="text-3xl font-bold">{n}</div><div className="text-sm text-muted mt-1">{l}</div></div>
        ))}
      </div>
      <div className="card-soft p-6">
        <h3 className="font-semibold mb-4">Revenue trend (₹L)</h3>
        <div className="flex items-end gap-3 h-72">
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-t-xl bg-gradient-to-t from-ink to-brand" style={{ height: `${(d/max)*100}%` }} />
              <div className="text-[10px] text-muted">{months[i]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
