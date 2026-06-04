import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["{lib,app,components}/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "./*" path alias for apps/web.
      "@": here("./"),
      // Lightweight stubs so component render tests don't pull Next's runtime.
      "next/image": here("./test/stubs/next-image.tsx"),
      "next/link": here("./test/stubs/next-link.tsx"),
    },
  },
});
