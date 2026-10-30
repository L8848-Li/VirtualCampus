import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()],
  base: "./",
  test: { include: ["tests/**/*.test.ts"], environment: "node", pool: 'threads', fileParallelism: false, maxWorkers: 1, isolate: true },
});
