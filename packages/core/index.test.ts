import { describe, expect, it } from "vitest";
import type {
	Branch,
	Contracts,
	DecisionTree,
	Fallback,
	LogicSpec,
	QualityGates,
	Reasoning,
	Step,
	Visual,
} from "./index.js";

describe("LogicSpec type hierarchy", () => {
	it("should accept a minimal LogicSpec with only required fields", () => {
		const minimal: LogicSpec = {
			spec_version: "1.0",
			name: "test",
		};

		expect(minimal.spec_version).toBe("1.0");
		expect(minimal.name).toBe("test");
	});

	it("should allow all optional fields to be undefined", () => {
		const minimal: LogicSpec = {
			spec_version: "1.0",
			name: "test",
		};

		expect(minimal.description).toBeUndefined();
		expect(minimal.imports).toBeUndefined();
		expect(minimal.reasoning).toBeUndefined();
		expect(minimal.steps).toBeUndefined();
		expect(minimal.contracts).toBeUndefined();
		expect(minimal.quality_gates).toBeUndefined();
		expect(minimal.decision_trees).toBeUndefined();
		expect(minimal.fallback).toBeUndefined();
		expect(minimal.global).toBeUndefined();
		expect(minimal.nodes).toBeUndefined();
		expect(minimal.edges).toBeUndefined();
		expect(minimal.visual).toBeUndefined();
		expect(minimal.metadata).toBeUndefined();
	});

	it("should accept a complete LogicSpec exercising major sub-types", () => {
		const reasoning: Reasoning = {
			strategy: "react",
			max_iterations: 10,
			temperature: 0.3,
			thinking_budget: 8000,
		};

		const analyzeBranches: Branch[] = [
			{ if: "{{ output.confidence < 0.6 }}", then: "retry_step" },
			{ default: true, then: "finalize" },
		];

		const analyzeStep: Step = {
			description: "Analyze the input",
			needs: ["gather"],
			instructions: "Analyze thoroughly",
			input_schema: { type: "object", required: ["query"] },
			output_schema: { type: "object", required: ["result"] },
			confidence: { minimum: 0.6, target: 0.85, escalate_below: 0.4 },
			branches: analyzeBranches,
			retry: { max_attempts: 3, backoff_coefficient: 2.0 },
			verification: {
				check: "{{ output.result != null }}",
				on_fail: "retry",
				on_fail_message: "No result produced",
			},
			timeout: "120s",
			allowed_tools: ["web_search"],
			denied_tools: ["code_execution"],
		};

		const contracts: Contracts = {
			inputs: [{ name: "query", type: "string", required: true }],
			outputs: [
				{
					name: "report",
					type: "object",
					required: ["summary"],
					properties: { summary: { type: "string" } },
				},
			],
			capabilities: {
				name: "Test Agent",
				version: "1.0.0",
				supported_domains: ["test"],
				languages: ["en"],
			},
			validation: {
				mode: "strict",
				on_input_violation: "reject",
				on_output_violation: "retry",
			},
		};

		const qualityGates: QualityGates = {
			pre_output: [
				{
					name: "confidence_floor",
					check: "{{ output.confidence >= 0.5 }}",
					severity: "error",
					on_fail: "escalate",
				},
			],
			invariants: [
				{
					name: "token_budget",
					check: "{{ reasoning.tokens_used < 10000 }}",
					on_breach: "summarize_and_conclude",
				},
			],
			self_verification: {
				enabled: true,
				strategy: "checklist",
				checklist: ["Output includes sources", "Confidence is justified"],
			},
		};

		const decisionTree: DecisionTree = {
			root: "check_type",
			nodes: {
				check_type: {
					condition: "{{ input.type }}",
					branches: [
						{ value: "question", next: "answer" },
						{ default: true, next: "clarify" },
					],
				},
			},
			terminals: {
				clarify: { action: "request_clarification", message: "Please clarify" },
			},
		};

		const fallback: Fallback = {
			strategy: "graceful_degrade",
			escalation: [
				{
					level: 1,
					trigger: "{{ confidence < 0.5 }}",
					action: "retry_with_different_strategy",
					new_strategy: "tot",
				},
			],
			degradation: [
				{
					when: "tools_unavailable",
					fallback_to: "reasoning_only",
					include_fields: ["summary"],
				},
			],
		};

		const visual: Visual = {
			icon: "brain",
			category: "reasoning",
			color: "#6366F1",
			inspector: [
				{
					key: "reasoning.strategy",
					label: "Strategy",
					type: "select",
					options: ["cot", "react", "tot"],
					default: "react",
				},
			],
			ports: {
				inputs: [{ name: "query", type: "string", required: true }],
				outputs: [{ name: "result", type: "object" }],
			},
		};

		const complete: LogicSpec = {
			spec_version: "1.0",
			name: "complete-test",
			description: "A complete test spec",
			imports: [{ ref: "./shared/retry.logic.md", as: "retry" }],
			reasoning,
			steps: { analyze: analyzeStep },
			contracts,
			quality_gates: qualityGates,
			decision_trees: { classifier: decisionTree },
			fallback,
			global: { max_total_time: "300s", fail_fast: false },
			nodes: {
				researcher: {
					logic_ref: "./researcher.logic.md",
					depends_on: [],
				},
			},
			edges: [
				{
					from: "researcher",
					to: "synthesizer",
					contract: { type: "object", required: ["findings"] },
				},
			],
			visual,
			metadata: { author: "test", tags: ["test"] },
		};

		expect(complete.spec_version).toBe("1.0");
		expect(complete.name).toBe("complete-test");
		expect(complete.reasoning?.strategy).toBe("react");
		expect(complete.steps?.analyze?.branches).toHaveLength(2);
		expect(complete.contracts?.inputs).toHaveLength(1);
		expect(complete.quality_gates?.pre_output).toHaveLength(1);
		expect(complete.decision_trees?.classifier?.root).toBe("check_type");
		expect(complete.fallback?.strategy).toBe("graceful_degrade");
		expect(complete.visual?.icon).toBe("brain");
		expect(complete.imports).toHaveLength(1);
		expect(complete.edges).toHaveLength(1);
	});
});
