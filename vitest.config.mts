import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Load .env for integration tests (DB/Redis/encryption key).
const env: Record<string, string> = {};
if (fs.existsSync(".env")) for (const l of fs.readFileSync(".env", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)="?(.*?)"?$/); if (m) env[m[1]] = m[2]; }

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { environment: "node", include: ["tests/**/*.test.ts"], env, testTimeout: 30000, fileParallelism: false },
});
