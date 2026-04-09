import { existsSync, readFileSync } from "node:fs";
import type { WorkflowContext } from "@logic-md/core";
import { compileWorkflow, parse, validate } from "@logic-md/core";
import type { Command } from "commander";
import type { Colors } from "../output/color.js";
import { formatError } from "../output/formatter.js";

export function registerCompileCommand(program: Command, colors: Colors): void {
	program
		.command("compile")
		.description("Compile a LOGIC.md file to JSON workflow")
		.argument("<file>", "path to .logic.md file")
		.option("--no-color", "disable colored output")
		.action(async (file: string) => {
			// 1. Check file exists
			if (!existsSync(file)) {
				process.stderr.write(`error: file not found: ${file}\n`);
				process.exit(2);
			}

			// 2. Read file
			const content = readFileSync(file, "utf8");

			// 3. Parse
			const parsed = parse(content);
			if (!parsed.ok) {
				for (const err of parsed.errors) {
					process.stderr.write(`${formatError(file, err, colors)}\n`);
				}
				process.exitCode = 1;
				return;
			}

			// 4. Validate
			const validated = validate(content);
			if (!validated.ok) {
				for (const err of validated.errors) {
					process.stderr.write(`${formatError(file, err, colors)}\n`);
				}
				process.exitCode = 1;
				return;
			}

			// 5. Compile — construct a minimal WorkflowContext
			const ctx: WorkflowContext = {
				currentStep: "",
				previousOutputs: {},
				input: null,
				attemptNumber: 1,
				branchReason: null,
				previousFailureReason: null,
				totalSteps: 0,
				completedSteps: [],
				dagLevels: [],
			};
			const compiled = compileWorkflow(validated.data, ctx);

			// 6. Output compiled JSON to stdout
			// Note: JSON.stringify silently drops function properties (qualityGates validators)
			// — this is expected. The compiled JSON contains workflow structure, not runtime executors.
			process.stdout.write(`${JSON.stringify(compiled, null, 2)}\n`);
		});
}
