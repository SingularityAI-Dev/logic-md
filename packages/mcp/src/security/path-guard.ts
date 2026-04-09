import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

export interface GuardResult {
	allowed: boolean;
	resolved: string;
	reason?: string;
}

/**
 * Two-step path traversal guard.
 *
 * Step 1: resolve() normalizes ../ sequences and anchors to cwd.
 * Step 2: realpath() follows symlinks to catch symlink-based escapes.
 *
 * This guards against CVE-2025-53109/53110 style symlink attacks.
 */
export async function guardPath(untrustedPath: string, cwd?: string): Promise<GuardResult> {
	const cwdResolved = cwd ?? process.cwd();

	// Step 1: normalize ../ sequences
	const normalized = resolve(cwdResolved, untrustedPath);

	// Step 2: follow symlinks (file may not exist yet — catch ENOENT)
	let real = normalized;
	try {
		real = await realpath(normalized);
	} catch {
		// File does not exist yet — use the normalized path for boundary check
	}

	// Boundary check: real path must be cwd itself or start with cwd + sep
	const cwdBoundary = cwdResolved.endsWith(sep) ? cwdResolved : cwdResolved + sep;
	const allowed = real === cwdResolved || real.startsWith(cwdBoundary);

	return {
		allowed,
		resolved: real,
		reason: allowed ? undefined : `Path "${untrustedPath}" resolves outside working directory`,
	};
}
