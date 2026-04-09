import { existsSync, readFileSync } from "node:fs";
import type {
	ExecutionContext,
	JsonSchemaObject,
	LogicSpec,
	ValidationError,
} from "@logic-md/core";
import {
	compileStep,
	ExpressionError,
	estimateTokens,
	evaluate,
	parse,
	resolve,
	validate,
} from "@logic-md/core";
import type { Command } from "commander";
import type { Colors } from "../output/color.js";
import { formatError } from "../output/formatter.js";
import type { BranchEval, ContractCheck, StepTestResult, TestResult } from "../types.js";

const TOKEN_WARNING_THRESHOLD = 4000;

/**
 * Check schema contract compatibility for a single DAG edge (A -> B).
 * A provides output_schema; B requires input_schema.
 */
function checkEdgeContract(
	fromName: string,
	fromSchema: JsonSchemaObject | undefined,
	toName: string,
	toSchema: JsonSchemaObject | undefined,
): ContractCheck {
	if (!fromSchema || !toSchema) {
		return {
			from: fromName,
			to: toName,
			status: "skipped",
			details: "no schema defined",
		};
	}

	const fromProps = fromSchema.properties ?? {};
	const toProps = toSchema.properties ?? {};
	const toKeys = Object.keys(toProps);

	if (toKeys.length === 0) {
		return {
			from: fromName,
			to: toName,
			status: "skipped",
			details: "no schema defined",
		};
	}

	const failures: string[] = [];

	for (const key of toKeys) {
		const toType = toProps[key]?.type;
		const fromProp = fromProps[key];

		if (!fromProp) {
			failures.push(`missing: ${fromName} does not output '${key}'`);
		} else {
			const fromType = fromProp.type;
			if (fromType !== toType) {
				failures.push(
					`type mismatch: ${fromName} outputs ${String(fromType)}, ${toName} expects ${String(toType)}`,
				);
			}
		}
	}

	if (failures.length > 0) {
		return {
			from: fromName,
			to: toName,
			status: "fail",
			details: failures.join("; "),
		};
	}

	return {
		from: fromName,
		to: toName,
		status: "pass",
		details: "all schema properties compatible",
	};
}

/**
 * Run contract compatibility checks for all DAG edges.
 * Returns a flat array of ContractCheck results.
 */
function checkContracts(spec: LogicSpec): ContractCheck[] {
	const checks: ContractCheck[] = [];
	const steps = spec.steps ?? {};

	for (const [toName, toStep] of Object.entries(steps)) {
		const needs = toStep.needs ?? [];
		for (const fromName of needs) {
			const fromStep = steps[fromName];
			if (!fromStep) continue;

			const check = checkEdgeContract(
				fromName,
				fromStep.output_schema,
				toName,
				toStep.input_schema,
			);
			checks.push(check);
		}
	}

	return checks;
}

export function registerTestCommand(program: Command, colors: Colors): void {
	program
		.command("test")
		.description("Dry-run a LOGIC.md file and simulate DAG execution")
		.argument("<file>", "path to .logic.md file")
		.option("--step <name>", "simulate a single step by name")
		.option("--input <json>", "provide JSON input for step simulation")
		.option("--json", "output machine-readable JSON TestResult")
		.option("--no-color", "disable colored output")
		.action(async (file: string, opts: { step?: string; input?: string; json?: boolean }) => {
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
					process.stderr.write(`${formatError(file, err as unknown as ValidationError, colors)}\n`);
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

			const spec = validated.data;

			// 5. Parse --input JSON if provided (early validation, exit 2 on malformed)
			let parsedInput: Record<string, unknown> | null = null;
			if (opts.input !== undefined) {
				try {
					parsedInput = JSON.parse(opts.input) as Record<string, unknown>;
				} catch {
					process.stderr.write(`error: --input is not valid JSON: ${opts.input}\n`);
					process.exit(2);
				}
			}

			// 6. Handle empty steps
			const stepKeys = Object.keys(spec.steps ?? {});
			if (stepKeys.length === 0) {
				if (opts.json) {
					const emptyResult: TestResult = {
						file,
						valid: true,
						stepCount: 0,
						dagLevels: [],
						steps: [],
						contractIssues: 0,
					};
					process.stdout.write(`${JSON.stringify(emptyResult, null, 2)}\n`);
				} else {
					process.stdout.write(`DAG Execution Plan: ${file}\n`);
					process.stdout.write(`  0 steps defined\n`);
				}
				return;
			}

			// 7. --step isolation mode
			if (opts.step !== undefined) {
				await runSingleStepMode(file, spec, opts.step, parsedInput, opts.json ?? false, colors);
				return;
			}

			// 8. Resolve DAG (full mode)
			const dag = resolve(spec.steps!);
			if (!dag.ok) {
				for (const err of dag.errors) {
					process.stderr.write(`error: ${err.message}\n`);
				}
				process.exitCode = 1;
				return;
			}

			// 9. Compile each step and estimate tokens
			const steps: StepTestResult[] = [];

			for (let levelIdx = 0; levelIdx < dag.levels.length; levelIdx++) {
				const level = dag.levels[levelIdx];
				for (const stepName of level) {
					const ctx: ExecutionContext = {
						currentStep: stepName,
						previousOutputs: {},
						input: parsedInput,
						attemptNumber: 1,
						branchReason: null,
						previousFailureReason: null,
					};

					let estimatedTokens = 0;
					let tokenWarning: string | undefined;

					try {
						const compiled = compileStep(spec, stepName, ctx);
						estimatedTokens = estimateTokens(compiled.systemPromptSegment);
						if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
							tokenWarning = `high token count: ${estimatedTokens} tokens exceeds threshold of ${TOKEN_WARNING_THRESHOLD}`;
						}
					} catch {
						// If compilation fails for a step, still include it with 0 tokens
						tokenWarning = "compilation failed — token estimate unavailable";
					}

					steps.push({
						stepName,
						dagLevel: levelIdx,
						parallelGroup: level,
						estimatedTokens,
						tokenWarning,
						contractCompatibility: [],
						branches: undefined,
					});
				}
			}

			// 10. Contract compatibility checks
			const allContracts = checkContracts(spec);
			let contractIssues = 0;

			for (const check of allContracts) {
				if (check.status === "fail") contractIssues++;

				// Assign to the destination step's contractCompatibility array
				const destStep = steps.find((s) => s.stepName === check.to);
				if (destStep) {
					destStep.contractCompatibility.push(check);
				}
			}

			// 11. Branch evaluation (--input mode)
			if (parsedInput !== null) {
				for (const stepResult of steps) {
					const step = spec.steps?.[stepResult.stepName];
					if (!step?.branches) continue;

					const branchEvals: BranchEval[] = [];
					for (const branch of step.branches) {
						if (branch.if !== undefined) {
							// Strip {{ }} delimiters if present
							const expr = branch.if.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
							try {
								const result = evaluate(expr, parsedInput as Record<string, unknown>);
								branchEvals.push({
									stepName: stepResult.stepName,
									branchLabel: branch.then,
									expression: branch.if,
									result,
								});
							} catch (e) {
								branchEvals.push({
									stepName: stepResult.stepName,
									branchLabel: branch.then,
									expression: branch.if,
									result: undefined,
									error: e instanceof ExpressionError ? e.message : String(e),
								});
							}
						} else if (branch.default) {
							branchEvals.push({
								stepName: stepResult.stepName,
								branchLabel: branch.then,
								expression: "(default)",
								result: "taken",
							});
						}
					}
					if (branchEvals.length > 0) {
						stepResult.branches = branchEvals;
					}
				}
			}

			// 12. Build TestResult
			const result: TestResult = {
				file,
				valid: true,
				stepCount: dag.order.length,
				dagLevels: dag.levels,
				steps,
				contractIssues,
			};

			// 13. Output
			if (opts.json) {
				process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
				return;
			}

			// Human-readable output
			const filename = file.split("/").pop() ?? file;
			process.stdout.write(`\n`);
			process.stdout.write(
				`DAG Execution Plan: ${colors.bold ? colors.bold(filename) : filename}\n`,
			);
			process.stdout.write(`  Steps: ${result.stepCount}  Levels: ${dag.levels.length}\n`);
			process.stdout.write(`\n`);

			for (let levelIdx = 0; levelIdx < dag.levels.length; levelIdx++) {
				const level = dag.levels[levelIdx];
				const levelLabel = level.length > 1 ? "parallel" : "sequential";
				process.stdout.write(`  Level ${levelIdx} (${levelLabel}):\n`);

				for (const stepName of level) {
					const stepResult = steps.find((s) => s.stepName === stepName);
					if (!stepResult) continue;

					if (stepResult.tokenWarning) {
						const icon = colors.yellow("⚠");
						process.stdout.write(
							`    ${icon} ${stepName.padEnd(30)} ~${stepResult.estimatedTokens} tokens  ${colors.yellow(stepResult.tokenWarning)}\n`,
						);
					} else {
						const icon = colors.green("✓");
						process.stdout.write(
							`    ${icon} ${stepName.padEnd(30)} ~${stepResult.estimatedTokens} tokens\n`,
						);
					}
				}
			}

			// Contract compatibility section
			if (allContracts.length > 0) {
				process.stdout.write(`\n`);
				process.stdout.write(`  Contract Compatibility:\n`);
				for (const check of allContracts) {
					const edgeLabel = `${check.from} -> ${check.to}`;
					if (check.status === "pass") {
						process.stdout.write(
							`    ${edgeLabel.padEnd(40)} output_schema <-> input_schema   ${colors.green("PASS")}\n`,
						);
					} else if (check.status === "skipped") {
						process.stdout.write(
							`    ${edgeLabel.padEnd(40)} ${check.details.padEnd(32)} ${colors.dim("SKIP")}\n`,
						);
					} else {
						process.stdout.write(
							`    ${edgeLabel.padEnd(40)} ${check.details.padEnd(32)} ${colors.red("FAIL")}\n`,
						);
					}
				}
			}

			// Agent boundary contracts (informational)
			if (spec.contracts) {
				const inputCount = spec.contracts.inputs?.length ?? 0;
				const outputCount = spec.contracts.outputs?.length ?? 0;
				process.stdout.write(`\n`);
				process.stdout.write(`  Agent Boundary Contract:\n`);
				process.stdout.write(`    Input fields:  ${inputCount}\n`);
				process.stdout.write(`    Output fields: ${outputCount}\n`);
			}

			// Branch evaluation section
			const stepsWithBranches = steps.filter((s) => s.branches && s.branches.length > 0);
			if (stepsWithBranches.length > 0) {
				process.stdout.write(`\n`);
				process.stdout.write(`  Branch Conditions (input: ${opts.input ?? "{}"}):\n`);
				for (const stepResult of stepsWithBranches) {
					for (const branch of stepResult.branches!) {
						const stepLabel = `Step ${branch.stepName}, branch "${branch.branchLabel}":`;
						if (branch.error) {
							process.stdout.write(
								`    ${stepLabel.padEnd(50)} ${branch.expression.padEnd(20)} -> ${colors.yellow(`error: ${branch.error}`)}\n`,
							);
						} else if (typeof branch.result === "boolean") {
							const resultStr = branch.result ? colors.green("true") : colors.red("false");
							process.stdout.write(
								`    ${stepLabel.padEnd(50)} {{ ${branch.expression} }}${"".padEnd(Math.max(0, 20 - branch.expression.length))} -> ${resultStr}\n`,
							);
						} else {
							process.stdout.write(
								`    ${stepLabel.padEnd(50)} ${branch.expression.padEnd(20)} -> ${String(branch.result)}\n`,
							);
						}
					}
				}
			}

			process.stdout.write(`\n`);
		});
}

/**
 * Single-step isolation mode (--step flag).
 */
async function runSingleStepMode(
	file: string,
	spec: LogicSpec,
	stepName: string,
	parsedInput: Record<string, unknown> | null,
	jsonMode: boolean,
	colors: Colors,
): Promise<void> {
	// Validate step exists
	if (!spec.steps?.[stepName]) {
		process.stderr.write(`error: step "${stepName}" not found in ${file}\n`);
		process.exit(2);
	}

	const step = spec.steps[stepName];

	const ctx: ExecutionContext = {
		currentStep: stepName,
		previousOutputs: {},
		input: parsedInput,
		attemptNumber: 1,
		branchReason: null,
		previousFailureReason: null,
	};

	let estimatedTokens = 0;
	let tokenWarning: string | undefined;

	try {
		const compiled = compileStep(spec, stepName, ctx);
		estimatedTokens = estimateTokens(compiled.systemPromptSegment);
		if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
			tokenWarning = `high token count: ${estimatedTokens} tokens exceeds threshold of ${TOKEN_WARNING_THRESHOLD}`;
		}
	} catch {
		tokenWarning = "compilation failed — token estimate unavailable";
	}

	// Contract checks: only edges involving this step
	const allContracts = checkContracts(spec);
	const stepContracts = allContracts.filter((c) => c.from === stepName || c.to === stepName);

	// Branch evaluation for this step
	let branchEvals: BranchEval[] | undefined;
	if (parsedInput !== null && step.branches) {
		branchEvals = [];
		for (const branch of step.branches) {
			if (branch.if !== undefined) {
				const expr = branch.if.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
				try {
					const result = evaluate(expr, parsedInput);
					branchEvals.push({
						stepName,
						branchLabel: branch.then,
						expression: branch.if,
						result,
					});
				} catch (e) {
					branchEvals.push({
						stepName,
						branchLabel: branch.then,
						expression: branch.if,
						result: undefined,
						error: e instanceof ExpressionError ? e.message : String(e),
					});
				}
			} else if (branch.default) {
				branchEvals.push({
					stepName,
					branchLabel: branch.then,
					expression: "(default)",
					result: "taken",
				});
			}
		}
	}

	const stepResult: StepTestResult = {
		stepName,
		dagLevel: 0,
		parallelGroup: [stepName],
		estimatedTokens,
		tokenWarning,
		contractCompatibility: stepContracts,
		branches: branchEvals,
	};

	const result: TestResult = {
		file,
		valid: true,
		stepCount: 1,
		dagLevels: [[stepName]],
		steps: [stepResult],
		contractIssues: stepContracts.filter((c) => c.status === "fail").length,
	};

	if (jsonMode) {
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		return;
	}

	// Human-readable single-step output
	const filename = file.split("/").pop() ?? file;
	process.stdout.write(`\n`);
	process.stdout.write(
		`Step Test: ${colors.bold ? colors.bold(stepName) : stepName}  (${filename})\n`,
	);

	if (tokenWarning) {
		process.stdout.write(
			`  Estimated tokens: ~${estimatedTokens}  ${colors.yellow(tokenWarning)}\n`,
		);
	} else {
		process.stdout.write(`  Estimated tokens: ~${estimatedTokens}\n`);
	}

	const needs = step.needs ?? [];
	process.stdout.write(`  Dependencies: ${needs.length > 0 ? needs.join(", ") : "none"}\n`);

	if (stepContracts.length > 0) {
		process.stdout.write(`\n  Contract:\n`);
		for (const check of stepContracts) {
			const edgeLabel = `${check.from} -> ${check.to}`;
			if (check.status === "pass") {
				process.stdout.write(`    ${edgeLabel.padEnd(40)} ${colors.green("PASS")}\n`);
			} else if (check.status === "skipped") {
				process.stdout.write(
					`    ${edgeLabel.padEnd(40)} ${colors.dim("SKIP")} (${check.details})\n`,
				);
			} else {
				process.stdout.write(
					`    ${edgeLabel.padEnd(40)} ${colors.red("FAIL")} ${check.details}\n`,
				);
			}
		}
	} else {
		process.stdout.write(`  Contract: no edges to check\n`);
	}

	if (branchEvals && branchEvals.length > 0) {
		process.stdout.write(`\n  Branch Conditions:\n`);
		for (const branch of branchEvals) {
			const label = `branch "${branch.branchLabel}":`;
			if (branch.error) {
				process.stdout.write(
					`    ${label.padEnd(30)} ${colors.yellow(`error: ${branch.error}`)}\n`,
				);
			} else if (typeof branch.result === "boolean") {
				const resultStr = branch.result ? colors.green("true") : colors.red("false");
				process.stdout.write(
					`    ${label.padEnd(30)} {{ ${branch.expression} }} -> ${resultStr}\n`,
				);
			} else {
				process.stdout.write(
					`    ${label.padEnd(30)} ${branch.expression} -> ${String(branch.result)}\n`,
				);
			}
		}
	}

	process.stdout.write(`\n`);
}
