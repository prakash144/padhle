import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // More specific aliases first so "@/lib/firebase" resolves to the test
      // stub (initializing Firestore in jsdom is not possible) while
      // everything else under "@/..." still maps to the real sources.
      { find: "@/lib/firebase", replacement: path.resolve(__dirname, "src/lib/firebase.test.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    exclude: ["src/lib/firebase.test.ts", "node_modules/**"],
  },
});