#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createAdapter } from "./llm-adapter.mjs";
import {
	aggregateMetrics,
	scoreDescribingVsDoing,
	scorePipelineCompletion,
	scoreQualityGateCompliance,
	scoreStructuredCompliance,
} from "./scoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const MODELS = [process.env.BENCHMARK_MODEL || "meta/llama-3.1-70b-instruct"];
const CONDITIONS = ["control", "treatment"];
const RUNS_PER_CONDITION = 10;
const DEFAULT_TASKS = ["code-review", "research-synthesis", "security-audit"];
const RESULTS_DIR = path.join(__dirname, "results");
const TASKS_DIR = path.join(__dirname, "tasks");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const taskArg = args.find((arg) => arg.startsWith("--task="))?.split("=")[1];
const selectedTasks = taskArg ? [taskArg] : DEFAULT_TASKS;

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
	fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Load task definition from JSON file
 */
function loadTask(taskName) {
	const taskPath = path.join(TASKS_DIR, `${taskName}.json`);
	if (!fs.existsSync(taskPath)) {
		throw new Error(`Task not found: ${taskPath}`);
	}
	return JSON.parse(fs.readFileSync(taskPath, "utf-8"));
}

/**
 * Load LOGIC.md spec for treatment condition
 */
function loadLogicMdSpec(specFile) {
	const specPath = path.join(TASKS_DIR, "specs", specFile);
	if (!fs.existsSync(specPath)) {
		console.warn(`Warning: LOGIC.md spec not found: ${specPath}`);
		return null;
	}
	return fs.readFileSync(specPath, "utf-8");
}

/**
 * Load sample input for task
 */
function loadTaskInput(inputFile) {
	const inputPath = path.join(TASKS_DIR, "inputs", inputFile);
	if (!fs.existsSync(inputPath)) {
		console.warn(`Warning: Input file not found: ${inputPath}`);
		return "Sample input data";
	}
	return fs.readFileSync(inputPath, "utf-8");
}

/**
 * Build system prompt based on condition and task
 */
function buildSystemPrompt(condition, task, logicMdSpec = null) {
	const basePrompt = `You are an AI assistant executing a ${task.name} task as part of an automated pipeline.
Your output MUST be valid JSON that matches the required schema.
Do not include explanatory text outside the JSON. Return ONLY the JSON object.

${
	condition === "treatment" && logicMdSpec
		? `

## Task Specification (LOGIC.md)

${logicMdSpec}

---
`
		: ""
}

## Required Output Schema

${JSON.stringify(task.expected_output_schema, null, 2)}
`;

	return basePrompt;
}

/**
 * Build user prompt
 */
function buildUserPrompt(task, inputData, condition) {
	let prompt = `Task: ${task.description}

Input:
${inputData}

---`;

	if (condition === "control") {
		prompt += "\n\nInstructions: " + task.control_prompt;
	} else {
		prompt += "\n\nExecute the reasoning steps defined in the specification above.";
		prompt += "\n\nYou MUST produce a structured JSON output that matches the schema.";
	}

	return prompt;
}

/**
 * Parse JSON from LLM response
 */
function parseJsonResponse(content) {
	try {
		// Try direct JSON parse
		return JSON.parse(content);
	} catch (e) {
		// Try to extract JSON from markdown code blocks
		const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			try {
				return JSON.parse(jsonMatch[1]);
			} catch {
				return null;
			}
		}

		// Try to find JSON object in content
		const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
		if (jsonObjectMatch) {
			try {
				return JSON.parse(jsonObjectMatch[0]);
			} catch {
				return null;
			}
		}

		return null;
	}
}

/**
 * Score a single run
 */
function scoreRun(output, task, condition) {
	const parsed = typeof output === "string" ? parseJsonResponse(output) : output;

	const metrics = {
		structuredCompliance: 0,
		describingVsDoing: 0,
		pipelineCompletion: 0,
		qualityGateCompliance: null,
	};

	const errors = [];

	// Score structured compliance
	if (parsed && typeof parsed === "object") {
		const complianceResult = scoreStructuredCompliance(parsed, task.expected_output_schema);
		metrics.structuredCompliance = complianceResult.score;
		if (!complianceResult.valid) {
			errors.push(...complianceResult.errors);
		}
	} else {
		metrics.structuredCompliance = 0;
		errors.push("Failed to parse JSON response");
	}

	// Score describing vs doing (on original output text)
	const describingResult = scoreDescribingVsDoing(output);
	metrics.describingVsDoing = describingResult.score;

	// Score pipeline completion (if output has steps)
	if (parsed && typeof parsed === "object") {
		const steps = Object.values(parsed).filter((v) => v != null);
		const pipelineResult = scorePipelineCompletion(steps);
		metrics.pipelineCompletion = pipelineResult.score;
	}

	// Score quality gates (treatment only)
	if (condition === "treatment" && parsed) {
		// Simulate quality gate checks based on schema requirements
		const gates = [];
		const schema = task.expected_output_schema;

		if (schema.required) {
			for (const requiredField of schema.required) {
				gates.push({
					name: `${requiredField}-present`,
					passed: requiredField in parsed,
				});
			}
		}

		const gateResult = scoreQualityGateCompliance(gates);
		metrics.qualityGateCompliance = gateResult.score;
	}

	return {
		metrics,
		errors,
		parsed,
	};
}

/**
 * Run a single task/model/condition combination
 */
async function runBenchmark(task, model, condition, adapter, run) {
	if (isVerbose) {
		console.log(`  Run ${run} - ${condition}...`);
	}

	const logicMdSpec = condition === "treatment" ? loadLogicMdSpec(task.treatment_spec) : null;
	const taskInput = loadTaskInput(task.input_file);

	const systemPrompt = buildSystemPrompt(condition, task, logicMdSpec);
	const userPrompt = buildUserPrompt(task, taskInput, condition);

	const startTime = Date.now();

	try {
		const response = await adapter.call(model, systemPrompt, userPrompt, {
			temperature: 0.7,
			max_tokens: 4096,
			timeout_ms: task.timeout_ms || 30000,
		});

		const executionTime = Date.now() - startTime;

		const { metrics, errors, parsed } = scoreRun(response.content, task, condition);

		return {
			task: task.name,
			model,
			condition,
			run,
			timestamp: new Date().toISOString(),
			metrics,
			aggregateScore: aggregateMetrics(metrics),
			executionTime,
			tokens: {
				input: response.inputTokens,
				output: response.outputTokens,
			},
			stopReason: response.stopReason,
			errors,
			outputLength: response.content.length,
		};
	} catch (error) {
		return {
			task: task.name,
			model,
			condition,
			run,
			timestamp: new Date().toISOString(),
			metrics: {
				structuredCompliance: 0,
				describingVsDoing: 100,
				pipelineCompletion: 0,
				qualityGateCompliance: null,
			},
			aggregateScore: 0,
			executionTime: Date.now() - startTime,
			tokens: { input: 0, output: 0 },
			stopReason: "error",
			errors: [error.message],
			outputLength: 0,
		};
	}
}

/**
 * Generate summary statistics
 */
function generateSummary(results) {
	const summary = {};

	// Group results by task, model, condition
	for (const result of results) {
		const key = `${result.task}:${result.model}:${result.condition}`;
		if (!summary[key]) {
			summary[key] = [];
		}
		summary[key].push(result);
	}

	// Calculate statistics for each group
	const stats = {};
	for (const [key, groupResults] of Object.entries(summary)) {
		const [task, model, condition] = key.split(":");

		const scores = groupResults.map((r) => r.aggregateScore);
		const compliance = groupResults.map((r) => r.metrics.structuredCompliance);
		const describingVsDoing = groupResults.map((r) => r.metrics.describingVsDoing);
		const completion = groupResults.map((r) => r.metrics.pipelineCompletion);

		const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
		const stddev = (arr) => {
			const m = mean(arr);
			const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
			return Math.sqrt(variance);
		};

		stats[key] = {
			task,
			model,
			condition,
			runs: groupResults.length,
			aggregateScore: {
				mean: Math.round(mean(scores)),
				stddev: Math.round(stddev(scores)),
				min: Math.min(...scores),
				max: Math.max(...scores),
			},
			structuredCompliance: {
				mean: Math.round(mean(compliance)),
				stddev: Math.round(stddev(compliance)),
			},
			describingVsDoing: {
				mean: Math.round(mean(describingVsDoing)),
				stddev: Math.round(stddev(describingVsDoing)),
			},
			pipelineCompletion: {
				mean: Math.round(mean(completion)),
				stddev: Math.round(stddev(completion)),
			},
		};
	}

	return stats;
}

/**
 * Write results to files
 */
function writeResults(results, stats) {
	// Write raw results
	const resultsPath = path.join(RESULTS_DIR, "results.json");
	fs.writeFileSync(resultsPath, JSON.stringify({ results, stats }, null, 2));

	// Write markdown summary
	const summaryPath = path.join(RESULTS_DIR, "results.md");
	let markdown = `# LOGIC.md Benchmark Results\n\n`;
	markdown += `Generated: ${new Date().toISOString()}\n\n`;

	if (isDryRun) {
		markdown += `**NOTE:** These are dry-run results using mock LLM responses.\n\n`;
	}

	markdown += `## Summary Statistics\n\n`;

	for (const [key, stat] of Object.entries(stats)) {
		markdown += `### ${stat.task} (${stat.model}) - ${stat.condition}\n\n`;
		markdown += `- Runs: ${stat.runs}\n`;
		markdown += `- Aggregate Score: ${stat.aggregateScore.mean} ± ${stat.aggregateScore.stddev} (range: ${stat.aggregateScore.min}-${stat.aggregateScore.max})\n`;
		markdown += `- Structured Compliance: ${stat.structuredCompliance.mean}% ± ${stat.structuredCompliance.stddev}%\n`;
		markdown += `- Describing vs Doing: ${stat.describingVsDoing.mean}% ± ${stat.describingVsDoing.stddev}% (lower is better)\n`;
		markdown += `- Pipeline Completion: ${stat.pipelineCompletion.mean}% ± ${stat.pipelineCompletion.stddev}%\n\n`;
	}

	markdown += `## Key Findings\n\n`;

	// Calculate treatment vs control differences
	const comparisons = {};
	for (const [key, stat] of Object.entries(stats)) {
		const baseKey = key.replace(/:control$|:treatment$/, "");
		if (!comparisons[baseKey]) {
			comparisons[baseKey] = {};
		}
		comparisons[baseKey][stat.condition] = stat;
	}

	for (const [baseKey, compData] of Object.entries(comparisons)) {
		if (compData.control && compData.treatment) {
			const controlScore = compData.control.aggregateScore.mean;
			const treatmentScore = compData.treatment.aggregateScore.mean;
			const diff = treatmentScore - controlScore;
			const pct = ((diff / controlScore) * 100).toFixed(1);

			markdown += `### ${baseKey}\n`;
			markdown += `- Control Aggregate Score: ${controlScore}\n`;
			markdown += `- Treatment Aggregate Score: ${treatmentScore}\n`;
			markdown += `- **Difference: ${diff > 0 ? "+" : ""}${diff} (${pct}%)**\n`;

			// Describe vs doing
			const controlDvD = compData.control.describingVsDoing.mean;
			const treatmentDvD = compData.treatment.describingVsDoing.mean;
			markdown += `- Control Describing vs Doing: ${controlDvD}%\n`;
			markdown += `- Treatment Describing vs Doing: ${treatmentDvD}%\n`;
			markdown += `- **Reduction: ${controlDvD - treatmentDvD}% points**\n\n`;
		}
	}

	fs.writeFileSync(summaryPath, markdown);

	console.log(`\nResults written to:`);
	console.log(`  - ${resultsPath}`);
	console.log(`  - ${summaryPath}`);
}

/**
 * Main entry point
 */
async function main() {
	console.log("LOGIC.md Benchmark Framework");
	console.log("============================\n");

	if (isDryRun) {
		console.log("Mode: DRY RUN (mock LLM responses)\n");
	}

	console.log(`Tasks: ${selectedTasks.join(", ")}`);
	console.log(`Models: ${MODELS.join(", ")}`);
	console.log(`Conditions: ${CONDITIONS.join(", ")}`);
	console.log(`Runs per condition: ${RUNS_PER_CONDITION}`);
	console.log(
		`Total runs: ${selectedTasks.length * MODELS.length * CONDITIONS.length * RUNS_PER_CONDITION}\n`,
	);

	const results = [];
	let completed = 0;
	const totalRuns = selectedTasks.length * MODELS.length * CONDITIONS.length * RUNS_PER_CONDITION;

	for (const taskName of selectedTasks) {
		console.log(`\nLoading task: ${taskName}`);
		const task = loadTask(taskName);
		console.log(`  Description: ${task.description}`);

		for (const model of MODELS) {
			console.log(`\nModel: ${model}`);
			const adapter = await createAdapter(model, isDryRun ? {} : null);

			for (const condition of CONDITIONS) {
				console.log(`  Condition: ${condition}`);

				for (let run = 1; run <= RUNS_PER_CONDITION; run++) {
					const result = await runBenchmark(task, model, condition, adapter, run);
					results.push(result);
					completed++;

					if (isVerbose) {
						console.log(`    Score: ${result.aggregateScore} | Time: ${result.executionTime}ms`);
					}

					process.stderr.write(`Progress: ${completed}/${totalRuns}\r`);
				}
			}
		}
	}

	console.log("\n\nProcessing results...");
	const stats = generateSummary(results);

	writeResults(results, stats);

	console.log("\nBenchmark complete!");
}

// Run
main().catch((error) => {
	console.error("Benchmark failed:", error);
	process.exit(1);
});
