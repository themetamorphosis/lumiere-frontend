"use client";

import Image from "next/image";
import { useState } from "react";

interface TMDBImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  fallback?: React.ReactNode;
  /** Required for `fill` images so the browser can pick a sensible source. */
  sizes?: string;
  onLoad?: () => void;
}

/**
 * Wrapper around next/image for TMDB and external media images.
 * Handles null/missing src, load failures, and provides a fallback.
 */
export default function TMDBImage({
  src,
  alt,
  className = "",
  width,
  height,
  fill = false,
  priority = false,
  fallback,
  sizes,
  onLoad,
}: TMDBImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 text-zinc-300 text-[10px] font-mono uppercase ${className}`}
      >
        {alt || "No Image"}
      </div>
    );
  }

  const imgProps: React.ComponentProps<typeof Image> = {
    src,
    alt,
    className,
    onError: () => setFailed(true),
    onLoad,
    priority,
  };

  if (fill) {
    return (
      <Image
        {...imgProps}
        alt={alt}
        fill
        sizes={sizes ?? "(max-width: 768px) 50vw, 200px"}
      />
    );
  }

  return (
    <Image
      {...imgProps}
      alt={alt}
      width={width ?? 300}
      height={height ?? 450}
    />
  );
}
