import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiCheckCircle,
  FiEye,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { adminApi } from "@/api/admin";
import { queryKeys } from "@/lib/query/queryKeys";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const fieldClass = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink";
const errorMessage = (error, fallback) => error.response?.data?.message || error.message || fallback;

const BannerPreview = ({ banner, onClose }) => (
  <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Homepage banner preview">
    <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex h-16 items-center justify-between border-b border-line px-5 sm:h-20 sm:px-8">
        <span className="text-xl font-extrabold text-ink">Rovauto</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-semibold text-muted sm:inline">Homepage preview</span>
          <button type="button" onClick={onClose} aria-label="Close preview" className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink hover:border-ink"><FiX /></button>
        </div>
      </div>
      <div className="relative flex min-h-[65vh] items-start overflow-hidden">
        <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="relative z-10 w-full px-5 py-10 sm:px-10 sm:py-14 lg:px-16">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl" style={{ color: banner.headingColor }}>{banner.heading || "Your public heading"}</h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: banner.descriptionColor }}>{banner.description || "Your public description"}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default function HomepageBanners() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [title, setTitle] = useState("");
  const [heading, setHeading] = useState("");
  const [headingColor, setHeadingColor] = useState("#ffffff");
  const [description, setDescription] = useState("");
  const [descriptionColor, setDescriptionColor] = useState("#ffffff");
  const [duration, setDuration] = useState("5");
  const [image, setImage] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [previewBanner, setPreviewBanner] = useState(null);

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(image);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const bannersQuery = useQuery({
    queryKey: queryKeys.admin.homepageBanners,
    queryFn: () => adminApi.getHomepageBanners(),
  });
  const banners = Array.isArray(bannersQuery.data?.banners) ? bannersQuery.data.banners : [];

  useEffect(() => {
    if (bannersQuery.data?.duration) {
      setDuration(String(bannersQuery.data.duration));
    }
  }, [bannersQuery.data?.duration]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.homepageBanners });
  };
  const mutationOptions = (successText) => ({
    onSuccess: async () => {
      setError("");
      setNotice(successText);
      await refresh();
    },
    onError: (requestError) => setError(errorMessage(requestError, "Unable to update homepage banners")),
  });
  const createMutation = useMutation({
    mutationFn: (payload) => adminApi.createHomepageBanner(payload),
    ...mutationOptions("Banner added successfully."),
  });
  const durationMutation = useMutation({
    mutationFn: (seconds) => adminApi.updateHomepageBannerDuration(seconds),
    ...mutationOptions("Slideshow duration updated."),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => adminApi.updateHomepageBanner(id, payload),
    ...mutationOptions("Banner updated successfully."),
  });
  const reorderMutation = useMutation({
    mutationFn: (ids) => adminApi.reorderHomepageBanners(ids),
    ...mutationOptions("Banner order updated."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => adminApi.deleteHomepageBanner(id),
    ...mutationOptions("Banner permanently deleted."),
  });
  const busy = createMutation.isPending || durationMutation.isPending || updateMutation.isPending || reorderMutation.isPending || deleteMutation.isPending;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!image) return setError("Select a banner image.");
    if (!image.type.startsWith("image/")) return setError("The selected file must be an image.");
    if (image.size > MAX_IMAGE_BYTES) return setError("Banner image must be under 8 MB.");
    const payload = new FormData();
    payload.append("title", title.trim());
    payload.append("heading", heading.trim());
    payload.append("headingColor", headingColor);
    payload.append("description", description.trim());
    payload.append("descriptionColor", descriptionColor);
    payload.append("image", image);
    try {
      await createMutation.mutateAsync(payload);
      setTitle("");
      setHeading("");
      setHeadingColor("#ffffff");
      setDescription("");
      setDescriptionColor("#ffffff");
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      // The mutation's error callback displays the server message.
    }
  };

  const saveDuration = (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const seconds = Number(duration);
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 300) {
      setError("Duration must be between 1 and 300 seconds.");
      return;
    }
    durationMutation.mutate(seconds);
  };

  const move = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= banners.length) return;
    const next = banners.map((banner) => banner.id);
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    reorderMutation.mutate(next);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Homepage appearance</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ink sm:text-3xl"><FiImage className="text-brand" /> Homepage Banners</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">Add and reorder rotating hero images, set one loop speed for every image, or deactivate an image without deleting it.</p>
          </div>
          <button type="button" onClick={() => void bannersQuery.refetch()} disabled={busy || bannersQuery.isFetching} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold hover:border-ink disabled:opacity-50"><FiRefreshCw className={bannersQuery.isFetching ? "animate-spin" : ""} /> Refresh</button>
        </div>
      </div>

      {(error || bannersQuery.error) && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><FiAlertTriangle className="mt-0.5 shrink-0" />{error || errorMessage(bannersQuery.error, "Unable to load banners")}</div>}
      {notice && <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"><FiCheckCircle className="mt-0.5 shrink-0" />{notice}</div>}

      <form onSubmit={saveDuration} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-end sm:p-6">
        <label className="w-full text-sm font-bold text-ink sm:max-w-xs">Rotation duration (seconds)<input required type="number" min="1" max="300" step="1" value={duration} onChange={(event) => setDuration(event.target.value)} className={`${fieldClass} mt-2`} /><span className="mt-1 block text-xs font-normal text-muted">Every active image changes after this same interval.</span></label>
        <button disabled={busy} className="h-10 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-50">{durationMutation.isPending ? "Saving…" : "Save duration"}</button>
      </form>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <label className="text-sm font-bold text-ink">Internal title<input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Monsoon campaign" className={`${fieldClass} mt-2`} /><span className="mt-1 block text-xs font-normal text-muted">Only admins can see this title.</span></label>
        <div className="grid gap-3 sm:grid-cols-[1fr_150px] sm:items-end">
          <label className="text-sm font-bold text-ink">Public heading<input required maxLength={140} value={heading} onChange={(event) => setHeading(event.target.value)} placeholder="Large heading shown over this banner" className={`${fieldClass} mt-2`} /><span className="mt-1 block text-xs font-normal text-muted">Uses the same size and position as the default heading.</span></label>
          <label className="text-sm font-bold text-ink">Heading color<div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-2"><input type="color" value={headingColor} onChange={(event) => setHeadingColor(event.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" /><span className="text-xs font-semibold uppercase text-muted">{headingColor}</span></div></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_150px] sm:items-end">
          <label className="text-sm font-bold text-ink">Public description<textarea required maxLength={400} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description shown below the heading" className="mt-2 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink" /><span className="mt-1 block text-xs font-normal text-muted">Uses the same size and width as the default description.</span></label>
          <label className="text-sm font-bold text-ink">Description color<div className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-2"><input type="color" value={descriptionColor} onChange={(event) => setDescriptionColor(event.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" /><span className="text-xs font-semibold uppercase text-muted">{descriptionColor}</span></div></label>
        </div>
        <label className="text-sm font-bold text-ink">Banner image<input ref={fileInputRef} required type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-lg border border-line p-2 text-sm" /><span className="mt-1 block text-xs font-normal text-muted">One image is responsively cropped on desktop and mobile. Maximum 8 MB.</span></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!imagePreviewUrl} onClick={() => setPreviewBanner({ imageUrl: imagePreviewUrl, heading, headingColor, description, descriptionColor })} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-bold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"><FiEye /> Preview</button>
          <button disabled={busy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-black hover:brightness-95 disabled:opacity-50"><FiPlus /> {createMutation.isPending ? "Uploading…" : "Add banner"}</button>
        </div>
      </form>

      <div className="space-y-3">
        {bannersQuery.isLoading ? <div className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">Loading banners…</div> : null}
        {!bannersQuery.isLoading && banners.length === 0 ? <div className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">No uploaded banners. The original Rovauto hero image is being used.</div> : null}
        {banners.map((banner, index) => (
          <article key={banner.id} className={`grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-[180px_1fr_auto] sm:items-center ${banner.isActive ? "border-line" : "border-dashed border-gray-300 opacity-70"}`}>
            <img src={banner.imageUrl} alt="" className="aspect-[2/1] w-full rounded-xl object-cover sm:w-[180px]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-ink">{banner.title}</h2><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${banner.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{banner.isActive ? "Active" : "Inactive"}</span></div>
              <p className="mt-1 text-sm text-muted">Position {index + 1} in the slideshow loop</p>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{banner.heading}</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{banner.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPreviewBanner(banner)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-xs font-bold hover:border-ink"><FiEye /> Preview</button>
                <button type="button" disabled={busy} onClick={() => updateMutation.mutate({ id: banner.id, payload: { isActive: !banner.isActive } })} className="h-9 rounded-lg border border-line px-3 text-xs font-bold hover:border-ink disabled:opacity-50">{banner.isActive ? "Deactivate" : "Activate"}</button>
                <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Permanently delete “${banner.title}”?`)) deleteMutation.mutate(banner.id); }} className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"><FiTrash2 /> Delete</button>
              </div>
            </div>
            <div className="flex gap-2 sm:flex-col">
              <button type="button" aria-label={`Move ${banner.title} up`} disabled={busy || index === 0} onClick={() => move(index, -1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:border-ink disabled:opacity-30"><FiArrowUp /></button>
              <button type="button" aria-label={`Move ${banner.title} down`} disabled={busy || index === banners.length - 1} onClick={() => move(index, 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line hover:border-ink disabled:opacity-30"><FiArrowDown /></button>
            </div>
          </article>
        ))}
      </div>
      {previewBanner && <BannerPreview banner={previewBanner} onClose={() => setPreviewBanner(null)} />}
    </div>
  );
}
