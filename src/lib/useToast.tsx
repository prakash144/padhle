import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  message: string;
  variant: "error" | "success";
}

interface ToastContextValue {
  error: (message: string) => void;
  success: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

/**
 * Global toast — the one piece of "did that actually save?" feedback every
 * write in the app was missing. A student tapping "Save" deserves to know if
 * it failed (offline, permissions, etc.) instead of the button just going
 * quiet.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, variant: ToastItem["variant"]) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value: ToastContextValue = {
    error: (message) => push(message, "error"),
    success: (message) => push(message, "success"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn(
                "pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-e2 backdrop-blur-xl",
                t.variant === "error"
                  ? "border-danger/30 bg-surface/95 text-danger"
                  : "border-success/30 bg-surface/95 text-success"
              )}
            >
              {t.variant === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
