import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ValidationError } from "@logic-md/core";
import { parse, resolveImports, validate } from "@logic-md/core";
import type { Command } from "commander";
import { glob } from "tinyglobby";
import type { Colors } from "../output/color.js";
import { formatError, formatSuccess } from "../output/formatter.js";

interface ValidateOptions {
	json?: boolean;
	fix?: boolean;
}

export interface FileValidationError extends ValidationError {
	file: string;
}

function applySpecVersionFix(_filePath: string, content: string): string | null {
	const lines = content.split("\n");
	const fmStart = lines.indexOf("---");
	const fmEnd = lines.indexOf("---", fmStart + 1);
	if (fmStart === -1 || fmEnd === -1) {
		return null;
	}

	const frontmatterLines = lines.slice(fmStart + 1, fmEnd);
	const specVersionIdx = frontmatterLines.findIndex((l) => l.startsWith("spec_version:"));

	if (specVersionIdx !== -1) {
		frontmatterLines[specVersionIdx] = 'spec_version: "1.0"';
	} else {
		frontmatterLines.unshift('spec_version: "1.0"');
	}

	const before = lines.slice(0, fmStart + 1).join("\n");
	const middle = frontmatterLines.join("\n");
	const after = lines.slice(fmEnd).join("\n");
	const separator = before.length > 0 ? "\n" : "";
	return [`${before + separator + middle}\n${after}`].join("");
}

export function validateFile(filePath: string, content: string): FileValidationError[] {
	// Step 1: Parse
	const parsed = parse(content);
	if (!parsed.ok) {
		return parsed.errors.map((e) => ({
			message: e.message,
			path: "",
			line: e.line,
			column: e.column,
			file: filePath,
		}));
	}

	// Step 2: Validate schema
	const validated = validate(content);
	if (!validated.ok) {
		return validated.errors.map((e) => ({
			...e,
			file: filePath,
		}));
	}

	// Step 3: Resolve imports
	const imports = resolveImports(validated.data, dirname(filePath));
	if (!imports.ok) {
		return imports.errors.map((e) => ({
			message: e.message,
			path: "",
			file: filePath,
		}));
	}

	return [];
}

function processFile(filePath: string, options: ValidateOptions): FileValidationError[] {
	let content: string;

	try {
		content = readFileSync(filePath, "utf8");
	} catch {
		return [
			{
				message: `File not found: ${filePath}`,
				path: "",
				line: undefined,
				column: undefined,
				file: filePath,
			},
		];
	}

	const initialErrors = validateFile(filePath, content);

	// Attempt --fix if requested
	if (options.fix && initialErrors.length > 0) {
		const hasSpecVersionError = initialErrors.some(
			(e) => e.path === "/spec_version" || e.message.toLowerCase().includes("spec_version"),
		);

		if (hasSpecVersionError) {
			const fixedContent = applySpecVersionFix(filePath, content);
			if (fixedContent !== null) {
				writeFileSync(filePath, fixedContent, "utf8");
				process.stderr.write(`${filePath}: fixed spec_version\n`);

				// Re-validate after fix
				const reErrors = validateFile(filePath, fixedContent);
				return reErrors;
			}
		}
	}

	return initialErrors;
}

export function registerValidateCommand(program: Command, colors: Colors): void {
	program
		.command("validate")
		.description("Validate LOGIC.md files against schema")
		.argument("<files...>", "file paths or glob patterns")
		.option("--json", "output machine-readable JSON")
		.option("--fix", "auto-fix safe issues")
		.option("--no-color", "disable colored output")
		.action(async (patterns: string[], options: ValidateOptions) => {
			// Expand globs
			const files = await glob(patterns, { expandDirectories: false });

			if (files.length === 0) {
				program.error("No files matched the given pattern(s)", { exitCode: 2 });
				return;
			}

			if (options.json) {
				// JSON mode: collect all errors, print once at end
				const allErrors: FileValidationError[] = [];

				for (const filePath of files) {
					const fileErrors = processFile(filePath, options);
					allErrors.push(...fileErrors);
				}

				process.stdout.write(`${JSON.stringify(allErrors, null, 2)}\n`);

				if (allErrors.length > 0) {
					process.exitCode = 1;
				}
			} else {
				// Human-readable mode
				let errorCount = 0;

				for (const filePath of files) {
					const fileErrors = processFile(filePath, options);

					if (fileErrors.length > 0) {
						for (const err of fileErrors) {
							process.stderr.write(`${formatError(filePath, err, colors)}\n`);
						}
						errorCount++;
					} else {
						process.stdout.write(`${formatSuccess(filePath, colors)}\n`);
					}
				}

				process.stderr.write(`${files.length} file(s) checked, ${errorCount} with errors\n`);

				if (errorCount > 0) {
					process.exitCode = 1;
				}
			}
		});
}
