import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/template-engine/**",
        "src/lib/invite-templates.ts",
        "src/lib/template-variables.ts",
        "src/lib/constants.ts",
        "src/hooks/useAccessInvites.tsx",
        "src/hooks/useUserRole.tsx",
        "src/hooks/useInviteDelivery.tsx",
      ],
      reporter: ["text", "text-summary", "lcov"],
      thresholds: {
        "src/lib/template-engine/**": {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
