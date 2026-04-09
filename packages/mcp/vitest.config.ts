import { defineConfig } from "vitest/config";

// MCP tests use node:test (not vitest). Run via: npm run test -w @logic-md/mcp
// This config exists to prevent vitest workspace from picking up .mjs test files.
export default defineConfig({ test: { include: [] } });
