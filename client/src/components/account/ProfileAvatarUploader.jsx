import { useRef, useState } from "react";
import { FiCamera, FiLoader } from "react-icons/fi";
import CustomerAvatar from "@/components/customer/CustomerAvatar";
import { profileApi } from "@/api/profile";
import { useApp } from "@/hooks/useApp";

const MAX_BYTES = 7 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export default function ProfileAvatarUploader({ compact = false }) {
  const { user, garage, setUser, setGarage } = useApp();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isSupport = pathname === "/support" || pathname.startsWith("/support/");
  const isGarage = pathname === "/garage" || pathname.startsWith("/garage/");
  const account = isGarage ? garage?.sessionUser || user : user;
  const name = account?.name || garage?.ownerName || garage?.name || "Account";

  const onSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");

    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Profile picture must be 7 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const updated = await profileApi.uploadAvatar(file, { support: isSupport });
      if (isGarage) {
        setGarage((current) => ({
          ...current,
          sessionUser: updated,
        }));
      } else {
        setUser(updated);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Unable to update profile picture.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`relative ${compact ? "h-10 w-10" : "h-12 w-12"}`}>
      <CustomerAvatar
        user={account}
        name={name}
        className="h-full w-full"
        fallbackClassName="bg-brand text-black"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Change profile picture"
        aria-label="Change profile picture"
        className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-ink text-white shadow-sm transition hover:scale-105 disabled:cursor-wait disabled:opacity-70"
      >
        {uploading ? <FiLoader className="animate-spin text-[11px]" /> : <FiCamera className="text-[11px]" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={onSelect}
      />
      {error && (
        <span className="absolute left-0 top-full z-50 mt-2 w-48 rounded-lg border border-red-200 bg-white p-2 text-[10px] font-semibold leading-4 text-red-700 shadow-lg">
          {error}
        </span>
      )}
    </div>
  );
}
