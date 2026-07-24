// =============================================================================
// LOGIC.md v1.0 - JSON Schema Loader & Validator Factory
// =============================================================================
// Loads the embedded JSON Schema draft-07 file and creates a cached ajv
// ValidateFunction for runtime validation of LogicSpec objects.
// =============================================================================

import { Ajv, type ValidateFunction } from "ajv";
import addFormatsMod from "ajv-formats";
import schemaJson from "./schema.json" with { type: "json" };
import type { LogicSpec } from "./types.js";

// ajv-formats is CJS; unwrap the interop default so this works under both
// Node ESM and single-file bundlers.
const addFormats = ((addFormatsMod as { default?: unknown }).default ?? addFormatsMod) as (
	ajv: Ajv,
) => Ajv;

/**
 * Returns the embedded JSON Schema (statically imported so it survives
 * bundling into single-file executables).
 */
export function getSchema(): Record<string, unknown> {
	return structuredClone(schemaJson) as Record<string, unknown>;
}

/** Cached validator instance (module-level singleton) */
let cachedValidator: ValidateFunction<LogicSpec> | undefined;

/**
 * Creates (or returns cached) ajv ValidateFunction for LogicSpec.
 *
 * Configuration:
 * - `allErrors: true` -- reports every validation error, not just the first
 * - `strict: true` -- enforces strict schema authoring
 * - `ajv-formats` -- enables format keywords like "uri"
 *
 * The validator is compiled once and cached for the lifetime of the module.
 */
export function createValidator(): ValidateFunction<LogicSpec> {
	if (cachedValidator) {
		return cachedValidator;
	}

	const ajv = new Ajv({ allErrors: true, strict: true });
	addFormats(ajv);

	const schema = getSchema();
	cachedValidator = ajv.compile<LogicSpec>(schema);
	return cachedValidator;
}
