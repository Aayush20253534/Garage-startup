import { useState } from "react";

export default function SafeImage({
  src,
  alt = "",
  fallback = null,
  onError,
  ...props
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = !src || failedSrc === src;

  if (failed) {
    return fallback;
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      onError={(event) => {
        setFailedSrc(src);
        onError?.(event);
      }}
    />
  );
}
