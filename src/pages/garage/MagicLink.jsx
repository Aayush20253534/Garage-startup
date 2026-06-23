import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { FiCheck, FiMapPin, FiPhone, FiTruck } from "react-icons/fi";

export default function MagicLink() {
  const { id } = useParams();
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="container-x py-10 max-w-2xl">
      <div className="card-soft p-7">
        <Logo />
        <span className="chip-brand mt-4 inline-flex">New Booking · No login required</span>
        <h1 className="text-2xl font-bold mt-3">Booking #{id}</h1>

        <div className="mt-6 grid gap-3 text-sm">
          <Row icon={FiTruck} l="Vehicle" r="Hyundai i20 Petrol" />
          <Row icon={FiCheck} l="Service" r="General Service · Est. ₹3,500" />
          <Row icon={FiMapPin} l="Location" r="Indirapuram, Ghaziabad · 2.5 km" />
        </div>

        <div className="mt-6 card-soft p-4 bg-bg-soft border-0">
          <div className="flex items-center justify-between"><span className="text-sm text-muted">Wallet balance</span><span className="font-bold">₹2,400</span></div>
          <div className="flex items-center justify-between mt-1"><span className="text-sm text-muted">Lead cost</span><span className="font-bold text-red-500">- ₹40</span></div>
        </div>

        {!accepted ? (
          <button onClick={() => setAccepted(true)} className="btn-primary w-full mt-6">Accept Booking & View Customer Number</button>
        ) : (
          <div className="mt-6 card-soft p-5 border-brand border-2">
            <span className="chip-brand">Accepted</span>
            <h3 className="font-semibold mt-2">Customer Details</h3>
            <div className="mt-3 grid gap-2 text-sm">
              <Row icon={FiCheck} l="Name" r="Ayush Kumar" />
              <Row icon={FiPhone} l="Phone" r="+91 98xxx xxx12" />
              <Row icon={FiMapPin} l="Address" r="H-37, Block H, Indirapuram" />
            </div>
            <Link to="/garage/jobs" className="btn-dark w-full mt-4">Go to Active Jobs</Link>
          </div>
        )}
      </div>
    </div>
  );
}
function Row({ icon: Ic, l, r }) {
  return <div className="flex items-center gap-3 py-2"><span className="grid place-items-center h-9 w-9 rounded-xl bg-bg-soft"><Ic /></span><div className="flex-1"><div className="text-xs text-muted">{l}</div><div className="font-semibold">{r}</div></div></div>;
}
