export default function Jobs() {
  const items = [
    { id: "RV2384", vehicle: "Hyundai i20", svc: "Standard Service", status: "In Progress" },
    { id: "RV2380", vehicle: "Tata Nexon", svc: "Denting (LR Door)", status: "Quality Check" },
    { id: "RV2375", vehicle: "Maruti Swift", svc: "AC Service", status: "Picked Up" },
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Active Jobs</h2>
      <div className="grid gap-3">
        {items.map((j) => (
          <div key={j.id} className="card-soft p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted">#{j.id}</div>
              <div className="font-semibold">{j.svc}</div>
              <div className="text-sm text-muted">{j.vehicle}</div>
            </div>
            <span className="chip-brand">{j.status}</span>
            <button className="btn-dark">Update</button>
          </div>
        ))}
      </div>
    </div>
  );
}
