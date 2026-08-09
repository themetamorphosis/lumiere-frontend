import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "lib/**",
        "hooks/**",
        "app/actions/**",
        "app/api/**",
        "middleware.ts",
        "components/**",
      ],
      exclude: [
        // Presentational/animation-only: WebGL and canvas effects that jsdom
        // cannot meaningfully execute.
        "components/Beams.tsx",
        "components/DashboardParticles.tsx",
        "components/CursorGlow.tsx",
        "components/HeroBackground.tsx",
        "components/DemoCard.tsx",
        "lib/discovery-constants.ts",
      ],
      thresholds: {
        // Global only. Per-file glob thresholds were tried here and silently
        // did NOT enforce (a deliberately impossible 100% on lib/session.ts
        // still passed), so they gave false assurance. Ratchet these upward as
        // component coverage grows; never lower them to turn a build green.
        // Ratcheted per phase; they only ever move up.
        //   baseline 15/10/9/15 → P1 16/11/9/17 → P2 below.
        // Phase 3 raises these substantially.
        statements: 18,
        branches: 12,
        functions: 12,
        lines: 19,
      },
    },
  },
});
