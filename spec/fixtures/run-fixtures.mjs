#!/usr/bin/env node
/**
 * Conformance test runner for LOGIC.md spec fixtures.
 *
 * Usage: node run-fixtures.mjs
 *
 * Runs all fixtures in valid/, invalid/, and edge-cases/ directories
 * against the @logic-md/core parser and validator.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "@logic-md/core";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function runFixture(category, filename) {
	const fixtureDir = join(__dirname, category);
	const mdPath = join(fixtureDir, filename);
	const expectedPath = join(fixtureDir, filename.replace(".logic.md", ".expected.json"));

	const mdContent = readFileSync(mdPath, "utf-8");
	const expected = JSON.parse(readFileSync(expectedPath, "utf-8"));

	const label = `${category}/${filename}`;

	try {
		// validate() accepts raw file content (with --- delimiters) and handles
		// both parsing and schema validation internally
		const result = validate(mdContent);

		if (expected.valid === true) {
			if (result.ok) {
				passed++;
				console.log(`  ✓ ${label}`);
			} else {
				failed++;
				const errs = result.errors?.map((e) => `${e.path}: ${e.message}`).join("; ") || "unknown";
				failures.push({ label, reason: `Expected valid but validation failed: ${errs}` });
				console.log(`  ✗ ${label} — expected valid but got errors: ${errs}`);
			}
		} else {
			// Expected invalid
			if (result.ok) {
				failed++;
				failures.push({ label, reason: "Expected invalid but validation passed" });
				console.log(`  ✗ ${label} — expected invalid but passed validation`);
			} else {
				// Check that error paths match expected
				const expectedErrors = expected.errors || [];
				let allMatch = true;
				for (const exp of expectedErrors) {
					// The validator returns errors with .path (string) and .message (string)
					// We check that at least one error has a path containing the expected path
					const found = result.errors?.some((e) => {
						// Normalize: validator may use "/property" or just "property" format
						const ePath = e.path || "/";
						return ePath === exp.path || ePath.includes(exp.path);
					});
					if (!found) {
						allMatch = false;
						failures.push({
							label,
							reason: `Expected error at path="${exp.path}" but not found. Got: ${JSON.stringify(result.errors?.map((e) => ({ path: e.path, message: e.message })))}`,
						});
					}
				}
				if (allMatch) {
					passed++;
					console.log(`  ✓ ${label} (correctly rejected)`);
				} else {
					failed++;
					console.log(`  ✗ ${label} — error path mismatch`);
				}
			}
		}
	} catch (err) {
		if (expected.valid === false) {
			passed++;
			console.log(`  ✓ ${label} (correctly threw: ${err.message})`);
		} else {
			failed++;
			failures.push({ label, reason: `Unexpected error: ${err.message}` });
			console.log(`  ✗ ${label} — unexpected error: ${err.message}`);
		}
	}
}

function runCategory(category) {
	const dir = join(__dirname, category);
	let files;
	try {
		files = readdirSync(dir)
			.filter((f) => f.endsWith(".logic.md"))
			.sort();
	} catch {
		console.log(`\n⚠ Skipping ${category}/ (directory not found)`);
		return;
	}

	console.log(`\n${category}/`);
	for (const file of files) {
		runFixture(category, file);
	}
}

console.log("LOGIC.md Conformance Test Suite\n================================");

runCategory("valid");
runCategory("invalid");
runCategory("edge-cases");

console.log(`\n================================`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failures.length > 0) {
	console.log("\nFailure details:");
	for (const f of failures) {
		console.log(`  ${f.label}: ${f.reason}`);
	}
	process.exit(1);
}

process.exit(0);
