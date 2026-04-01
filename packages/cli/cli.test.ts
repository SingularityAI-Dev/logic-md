// =============================================================================
// LOGIC.md CLI - Integration Tests
// =============================================================================
// Tests the CLI end-to-end by invoking it as a subprocess via execFileSync.
// Verifies exit codes, output content, color support, and all commands.
// =============================================================================

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const CLI_PATH = resolve(__dirname, "dist/cli.js");
const VALID_FIXTURE = resolve(__dirname, "fixtures/valid.logic.md");
const INVALID_FIXTURE = resolve(__dirname, "fixtures/invalid.logic.md");
const LINT_WARN_FIXTURE = resolve(__dirname, "fixtures/lint-warnings.logic.md");

interface RunResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

function run(args: string[], env?: Record<string, string>): RunResult {
	try {
		const stdout = execFileSync("node", [CLI_PATH, ...args], {
			encoding: "utf-8",
			env: { ...process.env, ...env },
			timeout: 10_000,
		});
		return { stdout, stderr: "", exitCode: 0 };
	} catch (err: unknown) {
		const error = err as {
			stdout?: string;
			stderr?: string;
			status?: number;
		};
		return {
			stdout: error.stdout ?? "",
			stderr: error.stderr ?? "",
			exitCode: error.status ?? 1,
		};
	}
}

beforeAll(() => {
	// Build the CLI so dist/cli.js is up to date
	execFileSync("npx", ["tsc", "--build", "tsconfig.build.json"], {
		encoding: "utf-8",
		cwd: resolve(__dirname, "../.."),
		timeout: 30_000,
	});
});

// ---------------------------------------------------------------------------
// validate command
// ---------------------------------------------------------------------------
describe("validate command", () => {
	it("exits 0 for valid file", () => {
		const result = run(["validate", VALID_FIXTURE]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Valid");
	});

	it("exits 1 for invalid file", () => {
		const result = run(["validate", INVALID_FIXTURE]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("error");
	});

	it("exits 2 for missing file", () => {
		const result = run(["validate", "nonexistent.logic.md"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("not found");
	});

	it("exits 1 with no file argument", () => {
		const result = run(["validate"]);
		expect(result.exitCode).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// lint command
// ---------------------------------------------------------------------------
describe("lint command", () => {
	it("exits 0 for clean file", () => {
		const result = run(["lint", VALID_FIXTURE]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("No issues found");
	});

	it("reports warnings for lint issues", () => {
		const result = run(["lint", LINT_WARN_FIXTURE]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("warning");
	});

	it("supports --json flag", () => {
		const result = run(["lint", "--json", LINT_WARN_FIXTURE]);
		// --json outputs to stdout even when there are warnings
		const parsed = JSON.parse(result.stdout);
		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// compile command
// ---------------------------------------------------------------------------
describe("compile command", () => {
	it("exits 0 and outputs JSON for valid file", () => {
		const result = run(["compile", VALID_FIXTURE]);
		expect(result.exitCode).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(parsed.name).toBe("test-strategy");
	});

	it("exits 1 for invalid file", () => {
		const result = run(["compile", INVALID_FIXTURE]);
		expect(result.exitCode).toBe(1);
	});

	it("exits 2 for missing file", () => {
		const result = run(["compile", "nonexistent.logic.md"]);
		expect(result.exitCode).toBe(2);
		expect(result.stderr).toContain("not found");
	});
});

// ---------------------------------------------------------------------------
// global flags
// ---------------------------------------------------------------------------
describe("global flags", () => {
	it("--help prints usage", () => {
		const result = run(["--help"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Usage");
	});

	it("--version prints version", () => {
		const result = run(["--version"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("unknown command exits 1", () => {
		const result = run(["foobar"]);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Unknown command");
	});
});

// ---------------------------------------------------------------------------
// NO_COLOR support
// ---------------------------------------------------------------------------
describe("NO_COLOR support", () => {
	it("output has no ANSI codes when NO_COLOR is set", () => {
		const result = run(["validate", INVALID_FIXTURE], { NO_COLOR: "1" });
		expect(result.stderr).not.toContain("\x1b[");
	});

	it("output has ANSI codes when NO_COLOR is unset", () => {
		// Remove NO_COLOR from env to ensure colors are enabled
		const cleanEnv: Record<string, string> = {};
		for (const [key, value] of Object.entries(process.env)) {
			if (key !== "NO_COLOR" && key !== "TERM" && value !== undefined) {
				cleanEnv[key] = value;
			}
		}
		const result = run(["validate", INVALID_FIXTURE], cleanEnv);
		expect(result.stderr).toContain("\x1b[");
	});
});
