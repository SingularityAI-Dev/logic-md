import { readFileSync, writeFileSync } from "node:fs";
import type { Command } from "commander";
import { glob } from "tinyglobby";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { Colors } from "../output/color.js";
import { formatSuccess } from "../output/formatter.js";

const CANONICAL_ORDER = [
	"spec_version",
	"name",
	"description",
	"imports",
	"reasoning",
	"steps",
	"contracts",
	"quality_gates",
	"decision_trees",
	"fallback",
	"global",
	"nodes",
	"edges",
	"visual",
	"metadata",
];

/**
 * Transform file content to canonical YAML key order with 2-space indentation.
 * Returns the canonical string, or null if no YAML frontmatter is found.
 * The markdown body after the closing --- is preserved byte-for-byte.
 */
export function toCanonical(content: string): string | null {
	const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fmMatch) {
		return null;
	}

	const body = content.slice(fmMatch[0].length);
	const parsed = parseYaml(fmMatch[1]) as Record<string, unknown>;

	// Reorder keys: canonical order first, then remaining unknown keys
	const reordered: Record<string, unknown> = {};
	for (const key of CANONICAL_ORDER) {
		if (Object.hasOwn(parsed, key)) {
			reordered[key] = parsed[key];
		}
	}
	for (const key of Object.keys(parsed)) {
		if (!CANONICAL_ORDER.includes(key)) {
			reordered[key] = parsed[key];
		}
	}

	const canonical = stringifyYaml(reordered, { lineWidth: 0, indent: 2 }).trimEnd();
	return `---\n${canonical}\n---${body}`;
}

export function registerFmtCommand(program: Command, colors: Colors): void {
	program
		.command("fmt")
		.description("Format LOGIC.md files to canonical style")
		.argument("<files...>", "files or glob patterns to format")
		.option("--check", "check formatting without writing (exits 1 if not canonical)")
		.option("--no-color", "disable colored output")
		.action(async (files: string[], options: { check?: boolean }) => {
			const checkMode = options.check ?? false;

			// Expand globs
			const expanded = await glob(files, { absolute: true });
			if (expanded.length === 0) {
				process.stderr.write(`No files matched: ${files.join(", ")}\n`);
				process.exit(2);
			}

			let hasNonCanonical = false;

			for (const filePath of expanded) {
				const content = readFileSync(filePath, "utf8");
				const canonical = toCanonical(content);

				if (canonical === null) {
					process.stderr.write(`${filePath}: skipped (no YAML frontmatter)\n`);
					continue;
				}

				if (checkMode) {
					if (content !== canonical) {
						process.stderr.write(`${filePath}: not in canonical format\n`);
						hasNonCanonical = true;
					}
					// quiet on success in check mode
				} else {
					if (content !== canonical) {
						writeFileSync(filePath, canonical, "utf8");
						process.stderr.write(`${filePath}: formatted\n`);
					} else {
						process.stdout.write(`${formatSuccess(filePath, colors)}\n`);
					}
				}
			}

			if (checkMode && hasNonCanonical) {
				process.exitCode = 1;
			}
		});
}
