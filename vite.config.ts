import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/padhle/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // three.js (lazy forest scene) and firestore are legitimately large but
    // only load on demand / are SDK-mandated — don't warn on them.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Keep only the big, independently-loadable trees separate. Every
          // other dependency (react + radix UI + its scroll/focus helpers,
          // lodash, prop-types, etc.) shares one runtime chunk — the radix
          // ecosystem cross-imports react heavily, so splitting it further
          // would create a vendor<->react circular-chunk warning.
          if (id.includes("/recharts/") || id.includes("/d3-") || id.includes("/victory-vendor/")) return "charts";
          if (
            id.includes("/framer-motion/") ||
            id.includes("/motion-dom/") ||
            id.includes("/motion-utils/") ||
            id.includes("/motion/")
          ) {
            return "motion";
          }
          // scoped "@firebase/*" packages hold the real SDK code; the bare
          // "firebase/*" entry module just re-exports them. webchannel-wrapper
          // is firestore's transport, so it ships with the firestore chunk.
          if (
            id.includes("/firebase/firestore/") ||
            id.includes("/@firebase/firestore/") ||
            id.includes("/@firebase/webchannel-wrapper/")
          ) {
            return "firestore";
          }
          if (id.includes("/firebase/") || id.includes("/@firebase/")) return "firebase";
          // three + @react-three/fiber are only imported by the lazily-loaded
          // Forest page, so keep them out of the startup "react" chunk.
          if (id.includes("/three/") || id.includes("/@react-three/")) return "three";
          return "react";
        },
      },
    },
  },
});
