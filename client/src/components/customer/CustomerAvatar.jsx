import SafeImage from "@/components/common/SafeImage";
import { resolveMediaUrl } from "@/utils/mediaUrl";

export default function CustomerAvatar({
  user,
  name,
  className = "h-10 w-10",
  fallbackClassName = "bg-brand text-black",
  imageClassName = "",
}) {
  const displayName = name || user?.name || "User";
  const avatarUrl = resolveMediaUrl(
    user?.customerProfile?.avatarUrl || user?.avatarUrl,
  );
  const fallback = (
    <span
      className={`grid h-full w-full place-items-center font-bold ${fallbackClassName}`}
      aria-hidden="true"
    >
      {displayName.charAt(0).toUpperCase() || "U"}
    </span>
  );

  return (
    <span
      className={`relative inline-grid shrink-0 overflow-hidden rounded-full ${className}`}
    >
      <SafeImage
        src={avatarUrl}
        alt={`${displayName} profile`}
        className={`h-full w-full object-cover ${imageClassName}`}
        fallback={fallback}
      />
    </span>
  );
}
