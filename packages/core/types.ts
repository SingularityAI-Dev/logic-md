// =============================================================================
// LOGIC.md v1.0 - Complete TypeScript Type Hierarchy
// =============================================================================
// Source of truth: LOGIC.md Specification v1.0
// Every type, interface, and string literal union in this file maps directly
// to a section of the specification.
// =============================================================================

// -----------------------------------------------------------------------------
// String Literal Unions (Section 3, 4, 5, 6, 8)
// -----------------------------------------------------------------------------

/** Reasoning strategy selection (Section 3.2) */
export type ReasoningStrategy = "cot" | "react" | "tot" | "got" | "plan-execute" | "custom";

/** Severity levels for quality gate checks (Section 6.1) */
export type Severity = "error" | "warning" | "info";

/** Action to take when a verification check fails (Section 4.1) */
export type OnFailAction = "retry" | "escalate" | "skip" | "abort" | "revise";

/** Step execution mode (Section 4.3) */
export type ExecutionMode = "sequential" | "parallel" | "conditional";

/** How parallel step results are joined (Section 4.3) */
export type JoinMode = "all" | "any" | "majority";

/** Contract validation strictness (Section 5.2) */
export type ValidationMode = "strict" | "warn" | "permissive";

/** Action on contract violation (Section 5.2) */
export type ViolationAction = "reject" | "coerce" | "warn" | "retry" | "escalate";

/** Fallback strategy when reasoning fails (Section 8) */
export type FallbackStrategy = "graceful_degrade" | "escalate" | "abort" | "retry_different";

/** Self-verification strategy (Section 6.2) */
export type SelfVerificationStrategy = "reflection" | "rubric" | "checklist" | "critic";

// -----------------------------------------------------------------------------
// Common Types
// -----------------------------------------------------------------------------

/**
 * Expression string using `{{ }}` delimiters (Section 4.2).
 * At the type level, expressions are plain strings. Expression parsing
 * and evaluation belong to the expression engine (Phase 5).
 */
export type Expression = string;

/**
 * An inline JSON Schema object as authored by users in LOGIC.md YAML.
 * Uses a permissive interface with an index signature because JSON Schema
 * is extensible and users may embed arbitrary subsets.
 */
export interface JsonSchemaObject {
	type?: string | string[];
	properties?: Record<string, JsonSchemaObject>;
	items?: JsonSchemaObject;
	required?: string[];
	enum?: unknown[];
	minimum?: number;
	maximum?: number;
	minItems?: number;
	maxItems?: number;
	minLength?: number;
	maxLength?: number;
	format?: string;
	[key: string]: unknown;
}

// -----------------------------------------------------------------------------
// Section 2.2: Imports
// -----------------------------------------------------------------------------

/** External LOGIC.md file import reference (Section 2.2) */
export interface Import {
	/** File path or URI to the external LOGIC.md file */
	ref: string;
	/** Namespace prefix for imported values */
	as: string;
}

// -----------------------------------------------------------------------------
// Section 3: Reasoning Configuration
// -----------------------------------------------------------------------------

/**
 * Global reasoning strategy configuration (Section 3).
 * Defines how the agent thinks -- which reasoning strategy to use,
 * iteration limits, temperature, and strategy-specific parameters.
 */
export interface Reasoning {
	/** The reasoning strategy to employ (Section 3.2) */
	strategy: ReasoningStrategy;
	/** Maximum reasoning loops before forced output */
	max_iterations?: number;
	/** Suggested temperature for reasoning steps */
	temperature?: number;
	/** Maximum tokens for internal reasoning (extended thinking) */
	thinking_budget?: number;
	/** Strategy-specific parameters (varies by strategy) */
	strategy_config?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Section 4: Steps
// -----------------------------------------------------------------------------

/** Confidence threshold configuration for a step (Section 4.1) */
export interface ConfidenceConfig {
	/** Below this value the step fails */
	minimum?: number;
	/** Aim for this confidence level */
	target?: number;
	/** Below this value escalate to human/supervisor */
	escalate_below?: number;
}

/** Conditional branch from a step (Section 4.1) */
export interface Branch {
	/** Expression that must evaluate to true for this branch */
	if?: Expression;
	/** Whether this is the default/fallthrough branch */
	default?: boolean;
	/** Target step name to route to */
	then: string;
}

/** Retry/resilience configuration for a step (Section 4.1) */
export interface RetryConfig {
	/** Maximum number of retry attempts */
	max_attempts?: number;
	/** Initial delay between retries (duration string) */
	initial_interval?: string;
	/** Multiplier for exponential backoff */
	backoff_coefficient?: number;
	/** Maximum delay between retries (duration string) */
	maximum_interval?: string;
	/** Error types that should not trigger a retry */
	non_retryable_errors?: string[];
}

/** Post-step verification check (Section 4.1) */
export interface Verification {
	/** Expression to evaluate after the step completes */
	check: Expression;
	/** Action to take if the check fails */
	on_fail: OnFailAction;
	/** Human-readable message when verification fails */
	on_fail_message?: string;
}

/**
 * A named reasoning step in the pipeline (Section 4.1).
 * Steps define the reasoning stages the agent works through.
 * They can be linear, branching, or cyclical.
 */
export interface Step {
	/** Human-readable description of what this step accomplishes */
	description?: string;
	/** Step names that must complete before this step runs */
	needs?: string[];
	/** Reasoning instructions injected into LLM context for this step */
	instructions?: string;
	/** JSON Schema for step input validation */
	input_schema?: JsonSchemaObject;
	/** JSON Schema for step output validation */
	output_schema?: JsonSchemaObject;
	/** Confidence thresholds for this step */
	confidence?: ConfidenceConfig;
	/** Conditional branching rules */
	branches?: Branch[];
	/** Retry/resilience configuration */
	retry?: RetryConfig;
	/** Post-step verification check */
	verification?: Verification;
	/** Maximum time allowed for this step (duration string) */
	timeout?: string;
	/** Tools this step is allowed to use */
	allowed_tools?: string[];
	/** Tools this step must NOT use */
	denied_tools?: string[];
	/** Execution mode for this step */
	execution?: ExecutionMode;
	/** Steps to run in parallel (when execution is parallel) */
	parallel_steps?: string[];
	/** How parallel results are joined */
	join?: JoinMode;
	/** Timeout for waiting on parallel step joins (duration string) */
	join_timeout?: string;
}

// -----------------------------------------------------------------------------
// Section 5: Contracts
// -----------------------------------------------------------------------------

/** A single input or output contract field (Section 5.1) */
export interface ContractField {
	/** Field name */
	name: string;
	/** Field type (JSON Schema type string) */
	type: string;
	/** Whether the field is required, or array of required sub-properties */
	required?: boolean | string[];
	/** Human-readable description of the field */
	description?: string;
	/** Additional validation constraints */
	constraints?: Record<string, unknown>;
	/** Sub-properties (for object-type fields) */
	properties?: Record<string, JsonSchemaObject>;
	/** Item schema (for array-type fields) */
	items?: JsonSchemaObject;
}

/** Capability advertisement for multi-agent systems (Section 5.1, A2A-inspired) */
export interface Capabilities {
	/** Display name of the agent/node capability */
	name?: string;
	/** Semantic version of the capability */
	version?: string;
	/** Human-readable description */
	description?: string;
	/** Domains this agent supports */
	supported_domains?: string[];
	/** Maximum input token count */
	max_input_tokens?: number;
	/** Average response time (duration string) */
	avg_response_time?: string;
	/** Supported languages (ISO codes) */
	languages?: string[];
}

/** Contract validation configuration (Section 5.2) */
export interface ContractValidation {
	/** Validation strictness mode */
	mode?: ValidationMode;
	/** Action when input violates the contract */
	on_input_violation?: ViolationAction;
	/** Action when output violates the contract */
	on_output_violation?: ViolationAction;
}

/**
 * Input/output type contracts for agents in multi-agent systems (Section 5).
 * Contracts specify what the agent accepts as input and what it promises
 * to produce as output.
 */
export interface Contracts {
	/** Input field definitions */
	inputs?: ContractField[];
	/** Output field definitions */
	outputs?: ContractField[];
	/** Capability advertisement */
	capabilities?: Capabilities;
	/** Validation configuration */
	validation?: ContractValidation;
}

// -----------------------------------------------------------------------------
// Section 6: Quality Gates
// -----------------------------------------------------------------------------

/** A quality gate check (Section 6.1) */
export interface Gate {
	/** Name of the quality gate */
	name: string;
	/** Expression to evaluate */
	check: Expression;
	/** Human-readable message when the gate fails */
	message?: string;
	/** Severity level of the gate */
	severity?: Severity;
	/** Action to take on failure */
	on_fail?: OnFailAction;
}

/** An invariant checked continuously during reasoning (Section 6.1) */
export interface Invariant {
	/** Name of the invariant */
	name: string;
	/** Expression to evaluate */
	check: Expression;
	/** Human-readable message when the invariant is breached */
	message?: string;
	/** Action to take on breach (step name or built-in action) */
	on_breach?: string;
}

/** Reflection-based self-verification configuration (Section 6.2) */
export interface ReflectionConfig {
	/** Prompt for the agent to review its output */
	prompt?: string;
	/** Maximum number of revision cycles */
	max_revisions?: number;
}

/** A single rubric scoring criterion (Section 6.2) */
export interface RubricCriterion {
	/** Name of the criterion */
	name: string;
	/** Weight in scoring (0-1) */
	weight: number;
	/** Description of what this criterion evaluates */
	description?: string;
}

/** Rubric-based self-verification configuration (Section 6.2) */
export interface RubricConfig {
	/** Scoring criteria */
	criteria?: RubricCriterion[];
	/** Minimum passing score */
	minimum_score?: number;
}

/** Self-verification loop configuration (Section 6.2) */
export interface SelfVerification {
	/** Whether self-verification is enabled */
	enabled?: boolean;
	/** Self-verification strategy */
	strategy?: SelfVerificationStrategy;
	/** Reflection configuration (when strategy is 'reflection') */
	reflection?: ReflectionConfig;
	/** Rubric configuration (when strategy is 'rubric') */
	rubric?: RubricConfig;
	/** Checklist items (when strategy is 'checklist') */
	checklist?: string[];
}

/**
 * Quality gates define cross-cutting verification rules (Section 6).
 * They apply globally or to specific steps, providing pre-output checks,
 * post-output checks, invariants, and self-verification loops.
 */
export interface QualityGates {
	/** Checks run before any step produces final output */
	pre_output?: Gate[];
	/** Checks run after output, can trigger revision */
	post_output?: Gate[];
	/** Invariants checked continuously during reasoning */
	invariants?: Invariant[];
	/** Self-verification loop configuration */
	self_verification?: SelfVerification;
}

// -----------------------------------------------------------------------------
// Section 7: Decision Trees
// -----------------------------------------------------------------------------

/** A branch within a decision node (Section 7) */
export interface DecisionBranch {
	/** Value to match against the condition */
	value?: unknown;
	/** Whether this is the default/fallthrough branch */
	default?: boolean;
	/** Target node or step name */
	next: string;
}

/** A decision node with a condition and branches (Section 7) */
export interface DecisionNode {
	/** Expression to evaluate for routing */
	condition: Expression;
	/** Branches to evaluate in order */
	branches: DecisionBranch[];
}

/** A terminal node that maps to an action (Section 7) */
export interface Terminal {
	/** Action to perform (step name or built-in action) */
	action: string;
	/** Human-readable message */
	message?: string;
}

/**
 * Inline decision tree for complex conditional routing (Section 7).
 * Decision trees route inputs through condition-based branching
 * to terminal actions or reasoning steps.
 */
export interface DecisionTree {
	/** Human-readable description of the decision tree */
	description?: string;
	/** Name of the root node to start evaluation */
	root: string;
	/** Named decision nodes */
	nodes: Record<string, DecisionNode>;
	/** Named terminal nodes */
	terminals?: Record<string, Terminal>;
}

// -----------------------------------------------------------------------------
// Section 8: Fallback & Escalation
// -----------------------------------------------------------------------------

/** A level in the escalation chain (Section 8) */
export interface EscalationLevel {
	/** Escalation level number (higher = more severe) */
	level: number;
	/** Expression that triggers this escalation level */
	trigger: Expression;
	/** Action to take at this level */
	action: string;
	/** New reasoning strategy to switch to */
	new_strategy?: ReasoningStrategy;
	/** Human-readable message */
	message?: string;
	/** Whether to include the reasoning trace */
	include_reasoning_trace?: boolean;
}

/** A graceful degradation rule (Section 8) */
export interface DegradationRule {
	/** Condition that triggers degradation */
	when: string;
	/** Target to degrade to */
	fallback_to: string;
	/** Human-readable message */
	message?: string;
	/** Fields to include in degraded output */
	include_fields?: string[];
	/** Fields to exclude from degraded output */
	exclude_fields?: string[];
}

/**
 * Fallback and escalation configuration (Section 8).
 * Defines what happens when reasoning fails -- strategy selection,
 * escalation chains, and graceful degradation rules.
 */
export interface Fallback {
	/** Global fallback strategy */
	strategy?: FallbackStrategy;
	/** Escalation chain (ordered by level) */
	escalation?: EscalationLevel[];
	/** Graceful degradation rules */
	degradation?: DegradationRule[];
}

// -----------------------------------------------------------------------------
// Section 9.1: Workflow-Level Configuration
// -----------------------------------------------------------------------------

/** Global constraints applied to all nodes in a workflow (Section 9.1) */
export interface GlobalConfig {
	/** Maximum total time for the workflow (duration string) */
	max_total_time?: string;
	/** Maximum total cost in USD */
	max_total_cost?: number;
	/** Whether to stop all branches on first failure */
	fail_fast?: boolean;
	/** Maximum number of nodes that can run in parallel */
	max_parallelism?: number;
}

/** A reference to a node's LOGIC.md file in a workflow (Section 9.1) */
export interface NodeRef {
	/** Path to the node's LOGIC.md file */
	logic_ref?: string;
	/** Nodes that must complete before this one */
	depends_on?: string[];
	/** Property overrides for this node */
	overrides?: Record<string, unknown>;
}

/** An edge connecting two nodes in a workflow (Section 9.1) */
export interface Edge {
	/** Source node name */
	from: string;
	/** Target node name */
	to: string;
	/** Inter-node data flow contract (JSON Schema) */
	contract?: JsonSchemaObject;
	/** Action on contract violation */
	on_contract_violation?: string;
}

// -----------------------------------------------------------------------------
// Section 10: Visual Builder Integration
// -----------------------------------------------------------------------------

/** A port definition for visual node wiring (Section 10.1) */
export interface VisualPort {
	/** Port name */
	name: string;
	/** Port data type */
	type: string;
	/** Whether the port connection is required */
	required?: boolean;
}

/** Input and output port definitions (Section 10.1) */
export interface VisualPorts {
	/** Input port definitions */
	inputs?: VisualPort[];
	/** Output port definitions */
	outputs?: VisualPort[];
}

/** A configurable field exposed in the visual node inspector panel (Section 10.1) */
export interface InspectorField {
	/** Property path (dot-notation key into the spec) */
	key: string;
	/** Display label in the inspector */
	label: string;
	/** Input control type */
	type: string;
	/** Available options (for select-type controls) */
	options?: string[];
	/** Default value */
	default?: unknown;
	/** Minimum value (for numeric controls) */
	min?: number;
	/** Maximum value (for numeric controls) */
	max?: number;
	/** Step increment (for slider controls) */
	step?: number;
}

/**
 * Visual builder integration configuration (Section 10).
 * Defines how a visual node-based agent builder discovers,
 * renders, and configures LOGIC.md-powered nodes.
 */
export interface Visual {
	/** Icon identifier */
	icon?: string;
	/** Palette category */
	category?: string;
	/** Node color (hex string) */
	color?: string;
	/** Configurable parameters exposed in the node inspector */
	inspector?: InspectorField[];
	/** Port definitions for visual wiring */
	ports?: VisualPorts;
}

// -----------------------------------------------------------------------------
// Section 2.1: Root LogicSpec
// -----------------------------------------------------------------------------

/**
 * Root interface for the LOGIC.md v1.0 specification (Section 2.1).
 *
 * A LogicSpec defines the complete declarative reasoning configuration
 * for an AI agent. It sits between identity (CLAUDE.md / SOUL.md) and
 * capability (SKILL.md / TOOLS.md), defining *how* an agent thinks.
 *
 * Only `spec_version` and `name` are required at the root level.
 * All other sections are optional and can be composed via imports.
 */
export interface LogicSpec {
	/** Specification version. Currently "1.0" */
	spec_version: string;
	/** Unique identifier for this reasoning configuration */
	name: string;
	/** Human-readable summary */
	description?: string;
	/** External LOGIC.md files to compose (Section 2.2) */
	imports?: Import[];
	/** Global reasoning strategy configuration (Section 3) */
	reasoning?: Reasoning;
	/** Named reasoning steps (Section 4) */
	steps?: Record<string, Step>;
	/** Input/output type contracts (Section 5) */
	contracts?: Contracts;
	/** Quality and verification rules (Section 6) */
	quality_gates?: QualityGates;
	/** Decision trees for complex routing (Section 7) */
	decision_trees?: Record<string, DecisionTree>;
	/** Fallback and escalation configuration (Section 8) */
	fallback?: Fallback;
	/** Global workflow constraints (Section 9.1) */
	global?: GlobalConfig;
	/** Node references in workflow-level specs (Section 9.1) */
	nodes?: Record<string, NodeRef>;
	/** Inter-node edges in workflow-level specs (Section 9.1) */
	edges?: Edge[];
	/** Visual builder integration (Section 10) */
	visual?: Visual;
	/** Arbitrary key-value metadata */
	metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Validation Result Types (Phase 4)
// -----------------------------------------------------------------------------

/** Structured validation error with optional source location */
export interface ValidationError {
	/** Human-readable error message */
	message: string;
	/** JSON Pointer path (e.g., "/steps/analyze/timeout") */
	path: string;
	/** 1-indexed line number in source file */
	line?: number;
	/** 1-indexed column number in source file */
	column?: number;
}

/** Successful validation -- typed data */
export interface ValidationSuccess {
	ok: true;
	data: LogicSpec;
}

/** Failed validation -- one or more errors */
export interface ValidationFailure {
	ok: false;
	errors: ValidationError[];
}

/** Discriminated union returned by validate() */
export type ValidationResult = ValidationSuccess | ValidationFailure;

// -----------------------------------------------------------------------------
// Compiler Types (v1.1)
// -----------------------------------------------------------------------------

/** Runtime quality gate validator function (v1.1 Compiler) */
export type QualityGateValidator = (output: unknown) => { passed: boolean; message?: string };

/** Retry policy derived from Temporal patterns (v1.1 Compiler) */
export interface RetryPolicy {
	maxAttempts: number;
	initialInterval: string;
	backoffCoefficient: number;
	maximumInterval: string;
	nonRetryableErrors: string[];
}

/** Runtime execution context for a single step (v1.1 Compiler) */
export interface ExecutionContext {
	currentStep: string;
	previousOutputs: Record<string, unknown>;
	input: unknown;
	attemptNumber: number;
	branchReason: string | null;
	previousFailureReason: string | null;
}

/** Workflow-level execution context extending step context (v1.1 Compiler) */
export interface WorkflowContext extends ExecutionContext {
	totalSteps: number;
	completedSteps: string[];
	dagLevels: string[][];
}

/** A compiled step ready for execution (v1.1 Compiler) */
export interface CompiledStep {
	systemPromptSegment: string;
	outputSchema: object | null;
	qualityGates: QualityGateValidator[];
	selfReflection: { prompt: string; minimumScore: number } | null;
	retryPolicy: RetryPolicy | null;
	metadata: {
		stepName: string;
		dagLevel: number;
		branchTaken: string | null;
		attemptNumber: number;
		totalSteps: number;
	};
	tokenWarning?: string;
}

/** A compiled workflow with all steps resolved (v1.1 Compiler) */
export interface CompiledWorkflow {
	steps: CompiledStep[];
	dagLevels: string[][];
	globalQualityGates: QualityGateValidator[];
	fallbackPolicy: Fallback | null;
	metadata: {
		name: string;
		totalSteps: number;
		totalLevels: number;
	};
}
