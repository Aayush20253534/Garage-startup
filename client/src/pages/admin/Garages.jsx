import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/api/admin";
import { FiCheck, FiEdit3, FiEye, FiImage, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";

const applicationStatuses = ["PENDING", "CHANGES_REQUESTED", "APPROVED", "DENIED"];

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

export default function Garages() {
  const [tab, setTab] = useState("applications");
  const [applications, setApplications] = useState([]);
  const [applicationStatus, setApplicationStatus] = useState("PENDING");
  const [garages, setGarages] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedGarageId, setSelectedGarageId] = useState("");
  const [selectedGarageDetails, setSelectedGarageDetails] = useState(null);
  const [serviceForm, setServiceForm] = useState({ serviceId: "", price: "" });
  const [noteByApplication, setNoteByApplication] = useState({});
  const [selectedApplicationIds, setSelectedApplicationIds] = useState([]);
  const [selectedGarageIds, setSelectedGarageIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedGarage = useMemo(
    () => selectedGarageDetails || garages.find((garage) => garage.id === selectedGarageId) || null,
    [garages, selectedGarageDetails, selectedGarageId]
  );

  const loadApplications = async () => {
    setLoading(true);
    setError("");
    try {
      setApplications(await adminApi.getApplications(applicationStatus));
      setSelectedApplicationIds([]);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load applications");
    } finally {
      setLoading(false);
    }
  };

  const loadGaragesAndServices = async () => {
    setLoading(true);
    setError("");
    try {
      const [garageList, serviceList] = await Promise.all([
        adminApi.getGarages(),
        adminApi.getAssignableServices(),
      ]);
      setGarages(garageList || []);
      setServices(serviceList || []);
      setSelectedGarageId((current) => current || garageList?.[0]?.id || "");
      setSelectedGarageDetails((current) =>
        current && garageList?.some((garage) => garage.id === current.id) ? current : null
      );
      setSelectedGarageIds((current) => current.filter((id) => garageList?.some((garage) => garage.id === id)));
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load garages/services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "applications") loadApplications();
    if (tab === "services") loadGaragesAndServices();
  }, [tab, applicationStatus]);

  const runApplicationAction = async (application, action) => {
    setError("");
    setSuccess("");
    const note = noteByApplication[application.id] || "";

    try {
      if (action === "approve") await adminApi.approveApplication(application.id, note);
      if (action === "changes") await adminApi.requestApplicationChanges(application.id, note);
      if (action === "deny") await adminApi.denyApplication(application.id, note);
      setSuccess(`Application ${action === "changes" ? "sent for changes" : `${action}d`}.`);
      await loadApplications();
    } catch (err) {
      setError(err.response?.data?.message || `Unable to ${action} application`);
    }
  };

  const saveGarageService = async (event) => {
    event.preventDefault();
    if (!selectedGarageId || !serviceForm.serviceId) return;

    setError("");
    setSuccess("");
    try {
      await adminApi.saveGarageService(selectedGarageId, {
        serviceId: serviceForm.serviceId,
        price: serviceForm.price,
        isActive: true,
      });
      setSuccess("Garage service saved.");
      setServiceForm({ serviceId: "", price: "" });
      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save garage service");
    }
  };

  const removeGarageService = async (serviceId) => {
    setError("");
    setSuccess("");
    try {
      await adminApi.removeGarageService(selectedGarageId, serviceId);
      setSuccess("Garage service removed.");
      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to remove garage service");
    }
  };

  const editGarageService = (item) => {
    setServiceForm({
      serviceId: item.serviceId,
      price: item.price || "",
    });
  };

  const openGarageDetails = async (garageId) => {
    setSelectedGarageId(garageId);
    setError("");
    try {
      setSelectedGarageDetails(await adminApi.getGarage(garageId));
    } catch (err) {
      setSelectedGarageDetails(null);
      setError(err.response?.data?.message || "Unable to load garage details");
    }
  };

  const toggleApplicationSelection = (applicationId) => {
    setSelectedApplicationIds((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId]
    );
  };

  const deleteApplications = async (applicationIds) => {
    if (!applicationIds.length) return;
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.deleteApplications(applicationIds);
      const deleted = result.deleted || applicationIds.length;
      setSuccess(`${deleted} application${deleted === 1 ? "" : "s"} deleted.`);
      await loadApplications();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete applications");
    }
  };

  const toggleGarageSelection = (garageId) => {
    setSelectedGarageIds((current) =>
      current.includes(garageId)
        ? current.filter((id) => id !== garageId)
        : [...current, garageId]
    );
  };

  const deleteGarages = async (garageIds) => {
    if (!garageIds.length) return;
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.deleteGarages(garageIds);
      const deleted = result.deletedGarages || garageIds.length;
      setSuccess(`${deleted} garage${deleted === 1 ? "" : "s"} and related DB records deleted.`);
      setSelectedGarageIds([]);
      if (garageIds.includes(selectedGarageId)) {
        setSelectedGarageId("");
        setSelectedGarageDetails(null);
      }
      await loadGaragesAndServices();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to delete garages");
    }
  };

  const canDeleteApplications = applicationStatus === "APPROVED" || applicationStatus === "DENIED";
  const allApplicationIds = applications.map((application) => application.id);
  const allGarageIds = garages.map((garage) => garage.id);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 overflow-hidden">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Garages</h2>
          <p className="text-muted">Approve garage applications and assign services.</p>
        </div>
        <div className="flex w-full gap-2 rounded-xl bg-bg-soft p-1 sm:w-auto">
          {[
            ["applications", "Applications"],
            ["services", "Garages"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-none ${tab === id ? "bg-ink text-white" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-xl bg-green-50 p-4 text-green-700">{success}</div>}

      {tab === "applications" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {applicationStatuses.map((status) => (
              <button
                key={status}
                onClick={() => setApplicationStatus(status)}
                className={`rounded-full px-4 py-2 text-xs font-semibold sm:text-sm ${applicationStatus === status ? "bg-ink text-white" : "bg-bg-soft text-muted"}`}
              >
                {status.replaceAll("_", " ")}
              </button>
            ))}
            <button onClick={loadApplications} className="btn-ghost !py-2 text-sm">
              <FiRefreshCw /> Refresh
            </button>
            {canDeleteApplications && applications.length > 0 && (
              <>
                <label className="inline-flex items-center gap-2 rounded-full bg-bg-soft px-4 py-2 text-xs font-semibold text-muted sm:text-sm">
                  <input
                    type="checkbox"
                    checked={selectedApplicationIds.length === applications.length}
                    onChange={(event) => setSelectedApplicationIds(event.target.checked ? allApplicationIds : [])}
                  />
                  Select all
                </label>
                <button
                  onClick={() => deleteApplications(selectedApplicationIds)}
                  disabled={!selectedApplicationIds.length}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50 sm:text-sm"
                >
                  <FiTrash2 /> Delete selected
                </button>
                <button
                  onClick={() => deleteApplications(allApplicationIds)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-red-700 px-4 py-2 text-xs font-semibold text-white sm:text-sm"
                >
                  <FiTrash2 /> Delete all
                </button>
              </>
            )}
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="card-soft p-5 text-muted">Loading applications...</div>
            ) : applications.length ? applications.map((application) => (
              <div key={application.id} className="card-soft p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    {canDeleteApplications && (
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-muted">
                        <input
                          type="checkbox"
                          checked={selectedApplicationIds.includes(application.id)}
                          onChange={() => toggleApplicationSelection(application.id)}
                        />
                        Select
                      </label>
                    )}
                    <div>
                      <h3 className="text-lg font-bold">{application.garageName}</h3>
                      <p className="text-sm text-muted">{application.ownerName} · {application.email} · {application.phone}</p>
                    </div>
                    <p className="break-words text-sm">{application.address}, {application.area}, {application.city}</p>
                    <p className="text-sm text-muted">
                      Radius: {application.workingRadiusKm || 15} km ·
                      Lat/Lng: {application.latitude ?? "N/A"}, {application.longitude ?? "N/A"}
                    </p>
                    {application.description && <p className="whitespace-pre-wrap text-sm text-muted">{application.description}</p>}
                    {application.images?.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 lg:grid-cols-6">
                        {application.images.map((image, index) => (
                          <a
                            key={image.id}
                            href={image.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-xl border border-line bg-bg-soft"
                          >
                            <img
                              src={image.imageUrl}
                              alt={`${application.garageName} ${index + 1}`}
                              className="aspect-square w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="chip-brand self-start">{application.status}</span>
                </div>

                {application.status !== "APPROVED" && application.status !== "DENIED" && (
                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto]">
                    <input
                      value={noteByApplication[application.id] || ""}
                      onChange={(e) => setNoteByApplication({ ...noteByApplication, [application.id]: e.target.value })}
                      placeholder="Optional admin note"
                      className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
                    />
                    <div className="flex flex-wrap gap-2 xl:flex-nowrap">
                      <button onClick={() => runApplicationAction(application, "approve")} className="btn-primary !px-4 !py-3 text-sm">
                        <FiCheck /> Approve
                      </button>
                      <button onClick={() => runApplicationAction(application, "changes")} className="btn-ghost !px-4 !py-3 text-sm">
                        <FiEdit3 /> Changes
                      </button>
                      <button onClick={() => runApplicationAction(application, "deny")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white">
                        <FiX /> Deny
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <div className="card-soft p-5 text-muted">No applications found.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="card-soft min-w-0 overflow-hidden">
            <div className="border-b border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">Garage Tab</h3>
                  <p className="mt-1 text-xs text-muted">Click a garage to view onboarding details.</p>
                </div>
                <button onClick={loadGaragesAndServices} className="btn-ghost !px-3 !py-2 text-sm" type="button">
                  <FiRefreshCw />
                </button>
              </div>
              {garages.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 rounded-full bg-bg-soft px-3 py-2 text-xs font-semibold text-muted">
                    <input
                      type="checkbox"
                      checked={selectedGarageIds.length === garages.length}
                      onChange={(event) => setSelectedGarageIds(event.target.checked ? allGarageIds : [])}
                    />
                    Select all
                  </label>
                  <button
                    onClick={() => deleteGarages(selectedGarageIds)}
                    disabled={!selectedGarageIds.length}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    type="button"
                  >
                    <FiTrash2 /> Delete selected
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto 2xl:max-h-[680px]">
              {garages.map((garage) => (
                <div
                  key={garage.id}
                  className={`flex items-start gap-3 border-b border-line p-4 transition ${selectedGarageId === garage.id ? "bg-ink text-white" : "hover:bg-bg-soft"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedGarageIds.includes(garage.id)}
                    onChange={() => toggleGarageSelection(garage.id)}
                    className="mt-1"
                  />
                  <button
                    onClick={() => openGarageDetails(garage.id)}
                    className="min-w-0 flex-1 text-left"
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-semibold">{garage.name}</span>
                      <FiEye className="shrink-0" />
                    </div>
                    <div className={`text-xs ${selectedGarageId === garage.id ? "text-white/70" : "text-muted"}`}>
                      {garage.city} · {garage.services?.length || 0} services · {garage.isActive ? "Active" : "Inactive"}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div className="card-soft p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-bold">{selectedGarage?.name || "Select a garage"}</h3>
                  {selectedGarage && (
                    <p className="mt-1 break-words text-sm text-muted">
                      {selectedGarage.address}, {selectedGarage.area}, {selectedGarage.city}
                    </p>
                  )}
                </div>
                {selectedGarage && (
                  <div className="flex flex-wrap gap-2">
                    <span className="chip-brand">{selectedGarage.isVerified ? "Verified" : "Unverified"}</span>
                    <span className="chip-brand">{selectedGarage.isActive ? "Active" : "Inactive"}</span>
                  </div>
                )}
              </div>
              {selectedGarage && (
                <p className="break-words text-sm text-muted">
                  {selectedGarage.address}, {selectedGarage.city} · Wallet {money(selectedGarage.wallet?.balance)}
                </p>
              )}
            </div>

            {selectedGarage && (
              <div className="card-soft space-y-3 p-5">
                <div>
                  <h4 className="font-bold">Garage Details</h4>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
                    {selectedGarage.description || "No garage description submitted."}
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-3">
                  <span><strong className="text-ink">Owner:</strong> {selectedGarage.owner?.name || "N/A"}</span>
                  <span><strong className="text-ink">Owner email:</strong> {selectedGarage.owner?.email || "N/A"}</span>
                  <span><strong className="text-ink">Owner phone:</strong> {selectedGarage.owner?.phone || "N/A"}</span>
                  <span><strong className="text-ink">Garage email:</strong> {selectedGarage.email || "N/A"}</span>
                  <span><strong className="text-ink">Garage phone:</strong> {selectedGarage.phone || "N/A"}</span>
                  <span><strong className="text-ink">WhatsApp:</strong> {selectedGarage.whatsappNo || "N/A"}</span>
                  <span><strong className="text-ink">City:</strong> {selectedGarage.city || "N/A"}</span>
                  <span><strong className="text-ink">Area:</strong> {selectedGarage.area || "N/A"}</span>
                  <span><strong className="text-ink">Radius:</strong> {selectedGarage.workingRadiusKm || 15} km</span>
                  <span><strong className="text-ink">Latitude:</strong> {selectedGarage.latitude ?? "N/A"}</span>
                  <span><strong className="text-ink">Longitude:</strong> {selectedGarage.longitude ?? "N/A"}</span>
                  <span><strong className="text-ink">Hours:</strong> {selectedGarage.openingTime || "N/A"} - {selectedGarage.closingTime || "N/A"}</span>
                  <span><strong className="text-ink">Rating:</strong> {selectedGarage.ratingAvg || 0} ({selectedGarage.ratingCount || 0})</span>
                  <span><strong className="text-ink">Application:</strong> {selectedGarage.applicationId || "N/A"}</span>
                  <span><strong className="text-ink">Created:</strong> {selectedGarage.createdAt ? new Date(selectedGarage.createdAt).toLocaleDateString() : "N/A"}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 text-sm font-bold">
                  <FiImage /> Uploaded Garage Photos ({selectedGarage.images?.length || 0}/15)
                </div>
                {selectedGarage.images?.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {selectedGarage.images.map((image, index) => (
                      <a
                        key={image.id}
                        href={image.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl border border-line bg-bg-soft"
                      >
                        <img
                          src={image.imageUrl}
                          alt={`${selectedGarage.name} garage photo ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                        <div className="px-2 py-1 text-xs text-muted">Photo {index + 1}</div>
                      </a>
                    ))}
                  </div>
                )}
                {!selectedGarage.images?.length && (
                  <div className="rounded-xl bg-bg-soft p-4 text-sm text-muted">
                    No garage photos were submitted during onboarding.
                  </div>
                )}
              </div>
            )}

            <form onSubmit={saveGarageService} className="card-soft grid min-w-0 gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_150px_auto]">
              <select
                required
                value={serviceForm.serviceId}
                onChange={(e) => setServiceForm({ ...serviceForm, serviceId: e.target.value })}
                className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              >
                <option value="">Select service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.category?.name ? `${service.category.name} - ` : ""}{service.name}
                  </option>
                ))}
              </select>
              <input
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                type="number"
                min="0"
                placeholder="Price"
                className="min-w-0 rounded-xl border border-line px-4 py-3 outline-none focus:border-ink"
              />
              <button disabled={!selectedGarageId} className="btn-primary !px-5">Save</button>
            </form>

            <div className="card-soft min-w-0 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-bg-soft text-left">
                  <tr>{["Service", "Category", "Price", ""].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {selectedGarage?.services?.length ? selectedGarage.services.map((item) => (
                    <tr key={item.id} className="border-t border-line">
                      <td className="px-4 py-3 font-medium">{item.service?.name}</td>
                      <td className="px-4 py-3">{item.service?.category?.name || "General"}</td>
                      <td className="px-4 py-3">{money(item.price || item.service?.basePrice)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => editGarageService(item)} className="btn-ghost !px-3 !py-2" type="button"><FiEdit3 /></button>
                          <button onClick={() => removeGarageService(item.serviceId)} className="rounded-xl bg-red-50 px-3 py-2 text-red-700" type="button"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" className="px-4 py-5 text-muted">No services assigned yet.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
