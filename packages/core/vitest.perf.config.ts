// =============================================================================
// Vitest config for the bench suite (`npm run bench`)
// =============================================================================
// Picks up only `__perf__/**/*.perf.ts`, runs them serially in a single fork
// for stable timings, and bypasses the default `**/*.test.ts` glob so the
// bench suite never runs as part of `npm test`.
// =============================================================================

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["**/__perf__/**/*.perf.ts"],
		// Serialise execution to minimise cross-test interference on timings.
		// `pool: "forks"` alone does NOT serialise — in Vitest 4 the option
		// that guarantees one-file-at-a-time execution is `fileParallelism:
		// false` at the top of the `test` block. (Pre-Vitest-4 this was
		// `poolOptions.forks.singleFork`; both `poolOptions` and the per-pool
		// `singleFork` were removed in the v4 pool rework.)
		pool: "forks",
		fileParallelism: false,
		// 60s ceiling — well above any realistic threshold; only fires on hangs.
		testTimeout: 60_000,
	},
});
