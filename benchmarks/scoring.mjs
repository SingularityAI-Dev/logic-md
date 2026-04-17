import Ajv from "ajv";

const ajv = new Ajv();

/**
 * scoreStructuredCompliance - Validates output against expected JSON schema
 *
 * Measures: Does the output match the expected JSON schema?
 * Returns: 0-100 score
 *   100 = perfect match to all required fields
 *   75 = all required fields present but some optional fields missing
 *   50 = most required fields present with some data quality issues
 *   0 = schema validation failed or required fields missing
 *
 * @param {unknown} output - The agent's output
 * @param {object} schema - JSON Schema for expected output
 * @returns {{score: number, valid: boolean, errors: string[]}}
 */
export function scoreStructuredCompliance(output, schema) {
	if (!output || typeof output !== "object") {
		return {
			score: 0,
			valid: false,
			errors: ["Output is not an object"],
		};
	}

	try {
		const validate = ajv.compile(schema);
		const valid = validate(output);

		if (valid) {
			return {
				score: 100,
				valid: true,
				errors: [],
			};
		}

		// Partial credit for validation failures
		// Check how many required fields are present
		const required = schema.required || [];
		const presentRequired = required.filter((field) => field in output).length;
		const requiredScore = required.length > 0 ? (presentRequired / required.length) * 100 : 100;

		return {
			score: Math.max(0, Math.min(100, Math.round(requiredScore * 0.75))),
			valid: false,
			errors: validate.errors.map((e) => `${e.instancePath || "root"}: ${e.message}`).slice(0, 5),
		};
	} catch (error) {
		return {
			score: 0,
			valid: false,
			errors: [`Schema validation error: ${error.message}`],
		};
	}
}

/**
 * scoreDescribingVsDoing - Detects "I would" patterns indicating description rather than execution
 *
 * Measures: How often does the agent describe what it would do instead of doing it?
 * Returns: 0-100 score where 0 = no describing patterns (good), 100 = all describing (bad)
 *
 * Patterns detected:
 * - "I would..."
 * - "As a ..., I would..."
 * - "I would then..."
 * - "One would..."
 * - "This would..."
 * - "Could..."
 * - "Should..."
 * - "Might..."
 *
 * @param {string} output - The agent's output text
 * @returns {{score: number, describingCount: number, sentenceCount: number, patterns: string[]}}
 */
export function scoreDescribingVsDoing(output) {
	if (!output || typeof output !== "string") {
		return {
			score: 0,
			describingCount: 0,
			sentenceCount: 0,
			patterns: [],
		};
	}

	// Split into sentences (basic heuristic)
	const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 10);
	const sentenceCount = sentences.length;

	if (sentenceCount === 0) {
		return {
			score: 0,
			describingCount: 0,
			sentenceCount: 0,
			patterns: [],
		};
	}

	// Patterns that indicate describing rather than doing
	const describingPatterns = [
		/\bI\s+would\b/gi,
		/\bAs\s+a\s+\w+,\s+I\s+would\b/gi,
		/\bI\s+would\s+then\b/gi,
		/\bOne\s+would\b/gi,
		/\bThis\s+would\b/gi,
		/\bcould\s+\w+\b/gi,
		/\bshould\s+\w+\b/gi,
		/\bmight\s+\w+\b/gi,
		/\bwould\s+provide\b/gi,
		/\bwould\s+create\b/gi,
		/\bwould\s+perform\b/gi,
		/\bwould\s+analyze\b/gi,
	];

	const foundPatterns = [];
	let describingCount = 0;

	for (const sentence of sentences) {
		let hasDescribing = false;
		for (const pattern of describingPatterns) {
			if (pattern.test(sentence)) {
				hasDescribing = true;
				const match = sentence.match(pattern);
				if (match) foundPatterns.push(match[0]);
			}
		}
		if (hasDescribing) describingCount++;
	}

	// Remove duplicates from patterns
	const uniquePatterns = [...new Set(foundPatterns)];

	const score = Math.round((describingCount / sentenceCount) * 100);

	return {
		score: Math.min(100, score),
		describingCount,
		sentenceCount,
		patterns: uniquePatterns,
	};
}

/**
 * scorePipelineCompletion - Measures if all reasoning steps produced outputs
 *
 * Measures: Did all multi-step reasoning steps produce non-empty outputs?
 * Returns: 0-100 score
 *   100 = all steps produced non-empty outputs
 *   75 = 75%+ of steps completed
 *   50 = 50%+ of steps completed
 *   0 = no steps completed or input is invalid
 *
 * @param {Array} stepOutputs - Array of step outputs (can be objects or strings)
 * @param {number} expectedSteps - Expected number of steps (optional, defaults to stepOutputs.length)
 * @returns {{score: number, completedSteps: number, totalSteps: number, emptySteps: number}}
 */
export function scorePipelineCompletion(stepOutputs, expectedSteps = null) {
	if (!Array.isArray(stepOutputs)) {
		return {
			score: 0,
			completedSteps: 0,
			totalSteps: expectedSteps || 0,
			emptySteps: 0,
		};
	}

	const totalSteps = expectedSteps || stepOutputs.length;

	if (totalSteps === 0) {
		return {
			score: 100,
			completedSteps: 0,
			totalSteps: 0,
			emptySteps: 0,
		};
	}

	let completedSteps = 0;
	let emptySteps = 0;

	for (const output of stepOutputs) {
		if (isEmptyOutput(output)) {
			emptySteps++;
		} else {
			completedSteps++;
		}
	}

	const score = Math.round((completedSteps / totalSteps) * 100);

	return {
		score: Math.min(100, score),
		completedSteps,
		totalSteps,
		emptySteps,
	};
}

/**
 * scoreQualityGateCompliance - Measures if quality gates pass
 *
 * Measures: What % of quality gates pass?
 * Returns: 0-100 score
 *
 * @param {Array} gates - Array of gate check objects with {name, passed: boolean}
 * @returns {{score: number, passedGates: number, totalGates: number, failedGates: string[]}}
 */
export function scoreQualityGateCompliance(gates) {
	if (!Array.isArray(gates)) {
		return {
			score: 0,
			passedGates: 0,
			totalGates: 0,
			failedGates: [],
		};
	}

	const totalGates = gates.length;
	if (totalGates === 0) {
		return {
			score: 100,
			passedGates: 0,
			totalGates: 0,
			failedGates: [],
		};
	}

	let passedGates = 0;
	const failedGates = [];

	for (const gate of gates) {
		if (gate.passed === true) {
			passedGates++;
		} else {
			failedGates.push(gate.name || "unnamed");
		}
	}

	const score = Math.round((passedGates / totalGates) * 100);

	return {
		score,
		passedGates,
		totalGates,
		failedGates,
	};
}

/**
 * aggregateMetrics - Combines all metrics into a single score summary
 *
 * @param {{
 *   structuredCompliance: number,
 *   describingVsDoing: number,
 *   pipelineCompletion: number,
 *   qualityGateCompliance?: number
 * }} metrics
 * @returns {number} Weighted aggregate score (0-100)
 */
export function aggregateMetrics(metrics) {
	// Weight breakdown:
	// - Structured compliance: 40% (primary outcome)
	// - Describing vs doing: 30% (failure detection, lower is better)
	// - Pipeline completion: 20% (robustness)
	// - Quality gate compliance: 10% (only for treatment)

	const weights = {
		structuredCompliance: 0.4,
		describingVsDoing: 0.3,
		pipelineCompletion: 0.2,
		qualityGateCompliance: 0.1,
	};

	let weightedSum = 0;
	let totalWeight = 0;

	if (metrics.structuredCompliance != null) {
		weightedSum += metrics.structuredCompliance * weights.structuredCompliance;
		totalWeight += weights.structuredCompliance;
	}

	if (metrics.describingVsDoing != null) {
		// Invert the score: lower describing-vs-doing is better
		const invertedScore = 100 - metrics.describingVsDoing;
		weightedSum += invertedScore * weights.describingVsDoing;
		totalWeight += weights.describingVsDoing;
	}

	if (metrics.pipelineCompletion != null) {
		weightedSum += metrics.pipelineCompletion * weights.pipelineCompletion;
		totalWeight += weights.pipelineCompletion;
	}

	if (metrics.qualityGateCompliance != null) {
		weightedSum += metrics.qualityGateCompliance * weights.qualityGateCompliance;
		totalWeight += weights.qualityGateCompliance;
	}

	if (totalWeight === 0) {
		return 0;
	}

	return Math.round(weightedSum / totalWeight);
}

// Helper function to determine if an output is empty
function isEmptyOutput(output) {
	if (output == null) return true;
	if (typeof output === "string") return output.trim().length === 0;
	if (typeof output === "object") {
		if (Array.isArray(output)) return output.length === 0;
		return Object.keys(output).length === 0;
	}
	return false;
}

export default {
	scoreStructuredCompliance,
	scoreDescribingVsDoing,
	scorePipelineCompletion,
	scoreQualityGateCompliance,
	aggregateMetrics,
};
