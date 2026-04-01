import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["**/*.test.ts"],
		coverage: {
			provider: "v8",
			include: ["parser.ts", "validator.ts", "expression.ts", "dag.ts", "imports.ts", "schema.ts"],
			reporter: ["text", "json-summary"],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
		},
	},
});
