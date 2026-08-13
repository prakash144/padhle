import { useState } from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  const initial = (name?.trim()?.[0] ?? "P").toUpperCase();

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 text-base font-semibold",
        className
      )}
      aria-hidden={showImage}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </span>
  );
}
