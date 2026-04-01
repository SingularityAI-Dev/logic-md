// =============================================================================
// LOGIC.md CLI - Terminal Output Formatting
// =============================================================================
// ANSI color helpers with NO_COLOR / TERM=dumb support.
// Uses raw escape codes -- zero dependencies, works on all terminals.
// =============================================================================

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

/** Whether color output is suppressed (NO_COLOR spec or dumb terminal). */
const noColor: boolean = "NO_COLOR" in process.env || process.env["TERM"] === "dumb";

function colorize(code: string, text: string): string {
	if (noColor) return text;
	return `${code}${text}${RESET}`;
}

export function formatError(msg: string): string {
	return colorize(RED, `error: ${msg}`);
}

export function formatWarning(msg: string): string {
	return colorize(YELLOW, `warning: ${msg}`);
}

export function formatInfo(msg: string): string {
	return colorize(CYAN, `info: ${msg}`);
}

export function formatSuccess(msg: string): string {
	return colorize(GREEN, msg);
}

export { BOLD, colorize, DIM, noColor, RESET };
