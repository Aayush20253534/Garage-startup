import { useEffect } from "react";
import { useSelector } from "react-redux";
import {
  FiCheckCircle,
  FiImage,
  FiMapPin,
  FiPhone,
  FiMail,
} from "react-icons/fi";
import { useApp } from "@/hooks/useApp";

export default function GarageProfile() {
  const { garage } = useSelector((state) => state.garage);
  const { garageToken, refreshGarage } = useApp();

  useEffect(() => {
    refreshGarage?.(garageToken).catch(() => {});
  }, [garageToken, refreshGarage]);

  const activation = garage?.activation || {};
  const uploadedImages = garage?.images || [];

  const minimumBalance = activation.minimumBalance || 1000;
  const balance =
    activation.walletBalance ||
    garage?.walletBalance ||
    garage?.wallet?.balance ||
    0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted">
          Manage your garage information and listing status
        </p>
      </div>

      <div className="card-soft p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-3xl font-bold">
            {garage?.name?.[0] || "G"}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">
                  {garage?.name || "Garage"}
                </h2>
                <p className="text-muted">
                  Owned by{" "}
                  {garage?.ownerName || garage?.owner?.name || "Garage owner"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  garage?.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {garage?.isActive ? "Active" : "Activation pending"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <p className="flex items-center gap-2">
                <FiMapPin className="text-muted" />
                {garage?.address || "Address not available"}
              </p>

              <p className="flex items-center gap-2">
                <FiPhone className="text-muted" />
                {garage?.phone || "Phone not available"}
              </p>

              <p className="flex items-center gap-2">
                <FiMail className="text-muted" />
                {garage?.email || "Email not available"}
              </p>

              <p className="flex items-center gap-2">
                <FiImage className="text-muted" />
                {uploadedImages.length} uploaded photos
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-soft p-5">
          <FiCheckCircle
            className={
              uploadedImages.length > 0 ? "text-green-700" : "text-muted"
            }
          />
          <h3 className="mt-3 font-bold">Garage Photos</h3>
          <p className="text-sm text-muted">{uploadedImages.length} uploaded</p>
        </div>

        <div className="card-soft p-5">
          <FiCheckCircle
            className={
              balance >= minimumBalance ? "text-green-700" : "text-muted"
            }
          />
          <h3 className="mt-3 font-bold">Wallet Balance</h3>
          <p className="text-sm text-muted">
            Rs. {Number(balance).toLocaleString()} / Rs.{" "}
            {Number(minimumBalance).toLocaleString()}
          </p>
        </div>

        <div className="card-soft p-5">
          <FiCheckCircle
            className={garage?.isActive ? "text-green-700" : "text-muted"}
          />
          <h3 className="mt-3 font-bold">Customer Visibility</h3>
          <p className="text-sm text-muted">
            {garage?.isActive
              ? "Garage is visible"
              : "Maintain required wallet balance"}
          </p>
        </div>
      </div>

      {uploadedImages.length > 0 && (
        <div className="card-soft p-6">
          <h3 className="mb-4 text-xl font-bold">Current Photos</h3>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {uploadedImages.map((image, index) => (
              <img
                key={image.id || image.imageUrl || index}
                src={image.imageUrl}
                alt="Garage"
                className="aspect-square rounded-xl object-cover"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
