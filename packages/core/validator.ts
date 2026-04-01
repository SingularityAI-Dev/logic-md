// =============================================================================
// LOGIC.md v1.0 - Schema Validator
// =============================================================================
// Validates raw LOGIC.md file content against the JSON Schema.
// Extracts YAML frontmatter, runs ajv validation with allErrors: true,
// and maps ajv error paths back to YAML source line numbers.
// =============================================================================

import { createRequire } from "node:module";
import { type Document, LineCounter, type Node, parseDocument } from "yaml";
import { createValidator } from "./schema.js";
import type { LogicSpec, ValidationError, ValidationResult } from "./types.js";

const require = createRequire(import.meta.url);
const matter = require("gray-matter") as typeof import("gray-matter");

/**
 * Offset added to YAML line numbers to account for the opening `---`
 * delimiter line that gray-matter strips before returning `result.matter`.
 */
const FRONTMATTER_OFFSET = 1;

/**
 * Convert an ajv instancePath (JSON Pointer) to a path array.
 * Splits on `/`, filters empty segments, converts numeric strings to numbers.
 */
function pathToArray(instancePath: string): Array<string | number> {
	return instancePath
		.split("/")
		.filter(Boolean)
		.map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg));
}

/**
 * Resolve the full property path for an ajv error.
 * - `required` keyword: append `params.missingProperty` to instancePath
 * - `additionalProperties` keyword: append `params.additionalProperty`
 * - Others: use instancePath directly
 */
function resolveErrorPath(error: {
	instancePath: string;
	keyword: string;
	params?: Record<string, unknown>;
}): string {
	const base = error.instancePath || "";
	if (error.keyword === "required" && error.params?.missingProperty) {
		return `${base}/${error.params.missingProperty as string}`;
	}
	if (error.keyword === "additionalProperties" && error.params?.additionalProperty) {
		return `${base}/${error.params.additionalProperty as string}`;
	}
	return base || "/";
}

/**
 * Format a human-readable error message from an ajv error.
 */
function formatErrorMessage(
	error: {
		keyword: string;
		message?: string;
		params?: Record<string, unknown>;
		schemaPath: string;
	},
	displayPath: string,
): string {
	switch (error.keyword) {
		case "required":
			return `Missing required property "${error.params?.missingProperty as string}" at ${displayPath}`;
		case "additionalProperties":
			return `Unknown property "${error.params?.additionalProperty as string}" at ${displayPath}`;
		case "type":
			return `Expected ${error.params?.type as string} at ${displayPath}`;
		case "enum": {
			const allowed = (error.params?.allowedValues as unknown[])?.map((v) => String(v)).join(", ");
			return `Invalid value at ${displayPath}. Allowed: ${allowed}`;
		}
		default:
			return `${error.message ?? "Validation error"} at ${displayPath}`;
	}
}

/**
 * Validate raw LOGIC.md file content against the JSON Schema.
 *
 * - Accepts the full file content string (with `---` delimiters)
 * - Extracts YAML frontmatter using gray-matter
 * - Validates against the JSON Schema using ajv (allErrors: true)
 * - Maps ajv error paths to YAML source line numbers
 * - Returns a discriminated union: ValidationSuccess | ValidationFailure
 */
export function validate(fileContent: string): ValidationResult {
	// Guard: empty or whitespace-only input
	if (!fileContent || fileContent.trim() === "") {
		return {
			ok: false,
			errors: [{ message: "Input is empty", path: "/" }],
		};
	}

	// Check for frontmatter delimiters
	if (!matter.test(fileContent)) {
		return {
			ok: false,
			errors: [
				{
					message: "No YAML frontmatter found. LOGIC.md files must start with `---`",
					path: "/",
				},
			],
		};
	}

	// Extract frontmatter
	let result: ReturnType<typeof matter>;
	try {
		result = matter(fileContent);
	} catch {
		return {
			ok: false,
			errors: [{ message: "Failed to parse YAML frontmatter", path: "/" }],
		};
	}

	// Run ajv validation
	const validator = createValidator();
	const valid = validator(result.data as LogicSpec);

	if (valid) {
		return { ok: true, data: result.data as LogicSpec };
	}

	// Build source position map from raw YAML.
	// gray-matter's `.matter` starts with a leading newline — strip it
	// so that YAML line numbers align correctly with FRONTMATTER_OFFSET.
	const yamlSource = (result.matter ?? "").replace(/^\n/, "");
	const lineCounter = new LineCounter();
	const doc = parseDocument(yamlSource, { lineCounter });

	// Map ajv errors to ValidationError[]
	const errors: ValidationError[] = (validator.errors ?? []).map((ajvError) => {
		const fullPath = resolveErrorPath(ajvError);
		const displayPath = fullPath === "/" ? "/" : fullPath;
		const message = formatErrorMessage(
			ajvError as Parameters<typeof formatErrorMessage>[0],
			displayPath,
		);

		const pathArray = pathToArray(fullPath);
		const position = resolveSourcePositionFromDoc(doc, lineCounter, pathArray);

		return {
			message,
			path: fullPath,
			...(position.line != null ? { line: position.line } : {}),
			...(position.column != null ? { column: position.column } : {}),
		};
	});

	return { ok: false, errors };
}

/**
 * Look up the source position of a YAML node given a path array,
 * using the already-parsed document and line counter.
 */
function resolveSourcePositionFromDoc(
	doc: Document,
	lineCounter: LineCounter,
	path: Array<string | number>,
): { line?: number; column?: number } {
	// Try exact path first
	let node = doc.getIn(path, true) as Node | undefined;

	// Fall back to parent path if not found
	if (!node && path.length > 0) {
		const parentPath = path.slice(0, -1);
		node = doc.getIn(parentPath, true) as Node | undefined;
	}

	if (node?.range) {
		const pos = lineCounter.linePos(node.range[0]);
		return {
			line: pos.line + FRONTMATTER_OFFSET,
			column: pos.col,
		};
	}

	return {};
}
