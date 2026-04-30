import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/lib/__tests__/integration.test.ts"],
    setupFiles: ["./src/integration-setup.ts"],
    testTimeout: 60000, // 実APIは最大60秒待つ
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
