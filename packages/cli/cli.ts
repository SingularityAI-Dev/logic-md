#!/usr/bin/env node
// =============================================================================
// LOGIC.md CLI - Entry Point
// =============================================================================
// Parses arguments with node:util.parseArgs and dispatches to command handlers.
// Exit codes: 0 = success, 1 = validation/lint errors, 2 = file not found.
// =============================================================================

import { parseArgs } from "node:util";
import { VERSION } from "@logic-md/core";
import { runCompile } from "./commands/compile.js";
import { runLint } from "./commands/lint.js";
import { runValidate } from "./commands/validate.js";

function printUsage(): void {
	console.log(`logic-md v${VERSION}

Usage: logic-md <command> [options] <file>

Commands:
  validate <file>   Validate a LOGIC.md file against the spec
  lint <file>       Check best practices and report warnings
  compile <file>    Parse, validate, resolve imports, and output JSON

Options:
  -h, --help        Show this help message
  -v, --version     Show version number
  --json            Output diagnostics as JSON (lint command)`);
}

const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	options: {
		help: { type: "boolean", short: "h", default: false },
		version: { type: "boolean", short: "v", default: false },
		json: { type: "boolean", default: false },
	},
	allowPositionals: true,
	strict: false,
});

if (values["version"]) {
	console.log(VERSION);
	process.exit(0);
}

const command = positionals[0];
const filePath = positionals[1];
const options = { json: values["json"] === true };

if (values["help"] && !command) {
	printUsage();
	process.exit(0);
}

let exitCode: number;

switch (command) {
	case "validate":
		exitCode = runValidate(filePath, options);
		break;
	case "lint":
		exitCode = runLint(filePath, options);
		break;
	case "compile":
		exitCode = runCompile(filePath, options);
		break;
	case undefined:
		printUsage();
		exitCode = 0;
		break;
	default:
		console.error(`Unknown command: ${command}`);
		printUsage();
		exitCode = 1;
		break;
}

process.exit(exitCode);
