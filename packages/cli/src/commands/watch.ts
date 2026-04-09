import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { watch } from "chokidar";
import type { Command } from "commander";
import type { Colors } from "../output/color.js";
import { formatError, formatSuccess, formatWarning } from "../output/formatter.js";
import { toCanonical } from "./fmt.js";
import { lintFile } from "./lint.js";
import type { FileValidationError } from "./validate.js";
import { validateFile } from "./validate.js";

const LOGIC_FILE_RE = /(\.(logic\.md)$|^LOGIC\.md$)/i;

interface WatchOptions {
	fix?: boolean;
}

function clearScreen(): void {
	if (process.stdout.isTTY) {
		process.stdout.write("\x1B[3J\x1B[2J\x1B[H");
	}
}

function timestamp(): string {
	return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function isLogicFile(filePath: string): boolean {
	const base = filePath.replace(/\\/g, "/").split("/").pop() ?? "";
	return LOGIC_FILE_RE.test(base);
}

async function runValidation(
	filePath: string,
	options: WatchOptions,
	watchedCount: number,
	justFormatted: Set<string>,
	colors: Colors,
): Promise<void> {
	clearScreen();

	const ts = timestamp();
	process.stderr.write(
		`[${ts}] Watching ${watchedCount} file(s)... (${colors.bold ? colors.bold(filePath) : filePath})\n\n`,
	);

	let content: string;
	try {
		content = readFileSync(filePath, "utf8");
	} catch {
		process.stderr.write(
			`${formatError(filePath, { message: `Cannot read file: ${filePath}`, path: "" }, colors)}\n`,
		);
		return;
	}

	// --fix: auto-format before validation
	if (options.fix) {
		const canonical = toCanonical(content);
		if (canonical !== null && canonical !== content) {
			writeFileSync(filePath, canonical, "utf8");
			// Mark as just-formatted so the chokidar change event is suppressed
			justFormatted.add(filePath);
			// Safety-net: auto-remove after 500ms in case the change event doesn't fire
			setTimeout(() => {
				justFormatted.delete(filePath);
			}, 500);
			content = canonical;
			process.stderr.write(`${filePath}: formatted\n`);
		}
	}

	// Step 1: validate
	const errors: FileValidationError[] = validateFile(filePath, content);

	if (errors.length > 0) {
		for (const err of errors) {
			process.stderr.write(`${formatError(filePath, err, colors)}\n`);
		}
		process.stderr.write(`\n[${ts}] ${errors.length} error(s), 0 warning(s)\n`);
		return;
	}

	// Step 2: lint (only if validation passed)
	const { issues } = lintFile(filePath, false);

	if (issues.length > 0) {
		for (const issue of issues) {
			process.stderr.write(`${formatWarning(filePath, issue, colors)}\n`);
		}
		process.stderr.write(`\n[${ts}] 0 error(s), ${issues.length} warning(s)\n`);
		return;
	}

	// All clear
	process.stdout.write(`${formatSuccess(filePath, colors)}\n`);
	process.stderr.write(`\n[${ts}] 0 error(s), 0 warning(s)\n`);
}

export function registerWatchCommand(program: Command, colors: Colors): void {
	program
		.command("watch")
		.description("Watch LOGIC.md files and validate on change")
		.argument("<paths...>", "files or directories to watch")
		.option("--fix", "auto-format files on save before validating")
		.option("--no-color", "disable colored output")
		.action((paths: string[], options: WatchOptions) => {
			const resolvedPaths = paths.map((p) => resolve(p));

			// Debounce timers per file path
			const timers = new Map<string, ReturnType<typeof setTimeout>>();

			// Tracks files we just wrote via --fix to suppress the resulting change event
			const justFormatted = new Set<string>();

			// Track watched logic files count
			const watchedFiles = new Set<string>();

			const watcher = watch(resolvedPaths, {
				persistent: true,
				ignoreInitial: false,
				awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
			});

			function handleFile(filePath: string): void {
				// Only handle .logic.md / LOGIC.md files
				if (!isLogicFile(filePath)) {
					return;
				}

				// Suppress events caused by our own --fix writes
				if (justFormatted.has(filePath)) {
					justFormatted.delete(filePath);
					return;
				}

				// Debounce: clear existing timer, start fresh
				const existing = timers.get(filePath);
				if (existing !== undefined) {
					clearTimeout(existing);
				}

				const timer = setTimeout(() => {
					timers.delete(filePath);
					runValidation(filePath, options, watchedFiles.size, justFormatted, colors).catch(
						(err: unknown) => {
							process.stderr.write(`Watch error: ${String(err)}\n`);
						},
					);
				}, 150);

				timers.set(filePath, timer);
			}

			watcher.on("add", (filePath: string) => {
				if (isLogicFile(filePath)) {
					watchedFiles.add(filePath);
				}
				handleFile(filePath);
			});

			watcher.on("change", (filePath: string) => {
				handleFile(filePath);
			});

			watcher.on("unlink", (filePath: string) => {
				watchedFiles.delete(filePath);
				const existing = timers.get(filePath);
				if (existing !== undefined) {
					clearTimeout(existing);
					timers.delete(filePath);
				}
			});

			watcher.on("ready", () => {
				process.stderr.write(
					`Watching ${watchedFiles.size} file(s) for changes... (Ctrl+C to stop)\n`,
				);
			});

			watcher.on("error", (err: unknown) => {
				process.stderr.write(
					`Watcher error: ${err instanceof Error ? err.message : String(err)}\n`,
				);
			});

			// Clean exit on Ctrl+C
			process.on("SIGINT", () => {
				watcher
					.close()
					.then(() => {
						process.exit(0);
					})
					.catch(() => {
						process.exit(0);
					});
			});
		});
}
