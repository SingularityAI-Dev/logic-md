// =============================================================================
// LOGIC.md v1.0 - Frontmatter Parser
// =============================================================================
// Extracts YAML frontmatter and markdown body from LOGIC.md file content.
// Returns a discriminated union (ParseSuccess | ParseFailure) so callers
// can narrow safely. Schema validation belongs to Phase 4 -- this module
// only extracts and casts.
// =============================================================================

import matter from "gray-matter";
import type { LogicSpec } from "./types.js";

// -----------------------------------------------------------------------------
// Result Types
// -----------------------------------------------------------------------------

/** Structured error with optional source location */
export interface ParseError {
	message: string;
	line?: number;
	column?: number;
}

/** Successful parse -- typed data + markdown body */
export interface ParseSuccess {
	ok: true;
	data: LogicSpec;
	content: string;
}

/** Failed parse -- one or more errors */
export interface ParseFailure {
	ok: false;
	errors: ParseError[];
}

/** Discriminated union returned by parse() */
export type ParseResult = ParseSuccess | ParseFailure;

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------

/**
 * Parse a LOGIC.md file string into typed frontmatter data and markdown body.
 *
 * - Returns `ParseSuccess` when frontmatter is successfully extracted.
 * - Returns `ParseFailure` with descriptive errors for all invalid inputs.
 * - Does NOT validate against the JSON Schema (that is the validator's job).
 */
export function parse(input: string): ParseResult {
	// Guard: empty or whitespace-only input
	if (!input || input.trim() === "") {
		return {
			ok: false,
			errors: [{ message: "Input is empty" }],
		};
	}

	// Pre-check: must have frontmatter delimiters
	if (!matter.test(input)) {
		return {
			ok: false,
			errors: [
				{
					message: "No YAML frontmatter found. LOGIC.md files must start with `---`",
				},
			],
		};
	}

	try {
		const result = matter(input);
		return {
			ok: true,
			data: result.data as LogicSpec,
			content: result.content,
		};
	} catch (error: unknown) {
		const err = error as {
			reason?: string;
			mark?: { line?: number; column?: number };
			message?: string;
		};
		const message = err.reason ?? err.message ?? "Failed to parse YAML frontmatter";
		const line = err.mark?.line != null ? err.mark.line + 1 : undefined;
		const column = err.mark?.column;

		return {
			ok: false,
			errors: [{ message, line, column }],
		};
	}
}
