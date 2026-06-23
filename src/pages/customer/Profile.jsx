import { useApp } from "@/hooks/useApp";
export default function Profile() {
  const { user } = useApp();
  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>
      <div className="card-soft p-6 grid gap-4">
        <div className="flex items-center gap-4"><span className="grid place-items-center h-16 w-16 rounded-2xl bg-ink text-white font-bold text-xl">{user?.name?.[0] || "A"}</span><div><div className="font-semibold text-lg">{user?.name}</div><div className="text-sm text-muted">+91 90000 00000</div></div></div>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Full Name</span><input defaultValue={user?.name} className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Email</span><input type="email" defaultValue="ayush@rovauto.in" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Address</span><textarea rows={3} defaultValue="H-37, Block H, Saket, New Delhi" className="px-4 py-3 rounded-xl border border-line focus:border-ink outline-none" /></label>
        <button className="btn-primary justify-self-start">Save Changes</button>
      </div>
    </div>
  );
}
