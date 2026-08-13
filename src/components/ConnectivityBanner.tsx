import { WifiOff } from "lucide-react";
import { useConnectivity } from "@/lib/useConnectivity";

export function ConnectivityBanner() {
  const online = useConnectivity();

  if (online) return null;

  return (
    <div className="z-20 flex items-center gap-2 border-l-2 border-l-warning bg-warning/10 px-4 py-1.5 text-xs font-medium text-warning">
      <WifiOff size={14} className="shrink-0" />
      <span>
        You're offline — showing saved data.{" "}
        <span className="hidden sm:inline">Changes will sync when you're back.</span>
      </span>
    </div>
  );
}