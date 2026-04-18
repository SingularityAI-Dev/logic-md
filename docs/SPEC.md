# LOGIC.md Specification v1.0

> **The declarative reasoning layer for AI agents.**
> Sits between identity (CLAUDE.md / SOUL.md) and capability (SKILL.md / TOOLS.md).
> Defines *how* an agent thinks — not who it is or what it can do.

---

## 1. Format

LOGIC.md uses **YAML frontmatter** (delimited by `---`) for machine-parseable reasoning configuration, with an optional **Markdown body** for human-readable reasoning documentation.

Parsers MUST process the YAML frontmatter. The Markdown body is informational — it helps developers understand reasoning intent but is NOT injected into LLM context unless explicitly configured.

```
---
# YAML frontmatter: machine-parseable reasoning spec
spec_version: "1.0"
name: "agent-name"
# ... configuration ...
---

# Markdown body: human-readable reasoning documentation
Explain reasoning strategy, design rationale, edge cases...
```

---

## 2. Schema Overview

### 2.1 Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `spec_version` | string | YES | Specification version. Currently `"1.0"` |
| `name` | string | YES | Unique identifier for this reasoning configuration |
| `description` | string | no | Human-readable summary |
| `imports` | array\<Import\> | no | External LOGIC.md files to compose |
| `reasoning` | Reasoning | no | Global reasoning strategy configuration |
| `steps` | map\<string, Step\> | no | Named reasoning steps |
| `contracts` | Contracts | no | Input/output type contracts |
| `quality_gates` | QualityGates | no | Global quality and verification rules |
| `fallback` | Fallback | no | Global fallback strategy and escalation chain (§8) |
| `decision_trees` | map\<string, DecisionTree\> | no | Named conditional routing trees (§7) |
| `visual` | Visual | no | Visual builder integration metadata (§10) |
| `global` | Global | no | Workflow-level cross-cutting constraints for multi-agent systems (§9.1) |
| `nodes` | map\<string, Node\> | no | Node definitions in a multi-agent workflow (§9.1) |
| `edges` | array\<Edge\> | no | Inter-node data flow contracts in a multi-agent workflow (§9.1) |
| `metadata` | map | no | Arbitrary key-value metadata |

### 2.2 Imports

Compose reasoning configurations from shared files. Follows the same `$ref` pattern as OpenAPI/JSON Schema.

```yaml
imports:
  - ref: "./shared/retry-policies.logic.md"
    as: policies           # namespace prefix
  - ref: "./shared/validation.logic.md"
    as: validation
  - ref: "./shared/contracts/message.logic.md"
    as: message_contract
```

**Resolution order** (most specific wins):
1. Current file values
2. Imported values (later imports override earlier)
3. Workflow-level LOGIC.md (if in a multi-agent system)
4. Global/default LOGIC.md

This mirrors CSS cascade / CLAUDE.md hierarchical loading.

---

## 3. Reasoning Configuration

### 3.1 Strategy Selection

```yaml
reasoning:
  strategy: react              # react | cot | tot | got | plan-execute | custom
  max_iterations: 8            # max reasoning loops before forced output
  temperature: 0.3             # suggested temperature for reasoning steps
  thinking_budget: 16000       # max tokens for internal reasoning (extended thinking)
  
  # Strategy-specific parameters
  strategy_config:
    # For ToT (Tree of Thoughts)
    branching_factor: 3        # candidates per expansion
    evaluation_method: vote    # vote | score | compare
    pruning_threshold: 0.4     # drop branches below this score
    max_depth: 5
    
    # For GoT (Graph of Thoughts)
    operations: [generate, score, refine, aggregate]
    
    # For ReAct
    observation_source: tools  # tools | memory | both
    max_actions_per_thought: 2
    
    # For Plan-Execute
    replan_on_failure: true
    max_replans: 3
```

### 3.2 Available Strategies

| Strategy | Key | Use When |
|----------|-----|----------|
| Chain-of-Thought | `cot` | Linear reasoning, step-by-step deduction |
| ReAct | `react` | Tool-using agents, observation-dependent reasoning |
| Tree-of-Thoughts | `tot` | Exploratory problems, multiple solution paths |
| Graph-of-Thoughts | `got` | Complex problems requiring merge/refine operations |
| Plan-then-Execute | `plan-execute` | Multi-step tasks with clear decomposition |
| Custom | `custom` | User-defined reasoning loop (specify in `strategy_config`) |

---

## 4. Steps

Steps define the reasoning pipeline — named stages the agent works through. Steps can be linear, branching, or cyclical.

### 4.1 Step Schema

```yaml
steps:
  step_name:
    description: "What this step accomplishes"
    
    # Dependencies — which steps must complete first
    needs: [prior_step_1, prior_step_2]
    
    # Reasoning instructions injected into the LLM context for this step
    instructions: |
      Analyze the input sources for relevance and credibility.
      Weight peer-reviewed sources higher than blog posts.
      If sources conflict, note the conflict explicitly.
    
    # Input/output typing
    input_schema:
      type: object
      required: [query]
      properties:
        query: { type: string }
    
    output_schema:
      type: object
      required: [findings, confidence]
      properties:
        findings:
          type: array
          items: { type: object }
          minItems: 1
        confidence:
          type: number
          minimum: 0
          maximum: 1
    
    # Confidence thresholds
    confidence:
      minimum: 0.6          # below this = step fails
      target: 0.85          # aim for this
      escalate_below: 0.4   # below this = escalate to human/supervisor
    
    # Conditional branching
    branches:
      - if: "{{ output.confidence < 0.6 }}"
        then: expand_research
      - if: "{{ output.findings.length == 0 }}"
        then: fallback_search
      - default: true
        then: synthesize
    
    # Retry/resilience
    retry:
      max_attempts: 3
      initial_interval: "1s"
      backoff_coefficient: 2.0
      maximum_interval: "30s"
      non_retryable_errors: [AuthenticationError, RateLimitError]
    
    # Post-step verification
    verification:
      check: "{{ output.findings.length >= 3 && output.confidence >= 0.6 }}"
      on_fail: retry          # retry | escalate | skip | abort | revise
      on_fail_message: "Insufficient findings or low confidence"
    
    # Timeout
    timeout: "120s"
    
    # Tools this step is allowed to use
    allowed_tools: [web_search, document_reader]
    
    # Tools this step must NOT use
    denied_tools: [code_execution]
```

### 4.1.1 Verification Properties

Step-level `verification` runs after the step executes and validates the output against a boolean `check` expression.

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `check` | string (expression) | yes | A `{{ }}` expression evaluating to a boolean. The verification passes when the expression is truthy. |
| `on_fail` | enum | no (defaults to `retry`) | The action to take when `check` evaluates falsy. One of `retry`, `escalate`, `skip`, `abort`, `revise`. |
| `on_fail_message` | string | no | Human-readable reason surfaced when `check` fails. Also supplied as feedback when `on_fail: revise`. |

`on_fail` semantics:

- `retry` — re-run the step using the same inputs, subject to the step's `retry` policy.
- `escalate` — hand off to the configured `fallback` chain (supervisor / human / alternative step).
- `skip` — continue downstream without this step's output. Downstream steps that `needs` it must tolerate absence.
- `abort` — fail the workflow and surface the verification error to the caller.
- `revise` — re-prompt the model with the failure captured as feedback (typically `on_fail_message`) so it can correct its own output.

### 4.2 Expression Syntax

Expressions use `{{ }}` delimiters (following n8n/GitHub Actions convention):

```yaml
# Access step outputs
"{{ steps.gather.output.sources.length }}"

# Access input contract values
"{{ input.query }}"

# Boolean logic
"{{ output.confidence > 0.8 && output.sources.length >= 3 }}"

# String operations
"{{ output.category == 'financial' }}"

# Array operations
"{{ output.errors.length == 0 }}"

# Ternary
"{{ output.confidence > 0.8 ? 'high' : 'low' }}"
```

### 4.3 Step Execution Modes

```yaml
steps:
  parallel_research:
    execution: parallel        # sequential (default) | parallel | conditional
    parallel_steps:
      - search_web
      - search_internal
      - search_academic
    join: all                  # all | any | majority
    join_timeout: "60s"
```

---

## 5. Contracts

Contracts define typed interfaces for agents in multi-agent systems. They specify what the agent accepts as input and what it promises to produce as output.

### 5.1 Contract Schema

```yaml
contracts:
  # What this agent/node accepts
  inputs:
    - name: research_query
      type: string
      required: true
      description: "The research question to investigate"
      constraints:
        max_length: 2000
    
    - name: context_documents
      type: array
      required: false
      items:
        type: object
        properties:
          title: { type: string }
          content: { type: string }
          source_url: { type: string, format: uri }
  
  # What this agent/node promises to produce
  outputs:
    - name: report
      type: object
      required: [summary, findings, confidence_score]
      properties:
        summary: { type: string, maxLength: 500 }
        findings:
          type: array
          items:
            type: object
            required: [claim, evidence, confidence]
            properties:
              claim: { type: string }
              evidence: { type: string }
              confidence: { type: number, minimum: 0, maximum: 1 }
              sources: { type: array, items: { type: string, format: uri } }
        confidence_score: { type: number, minimum: 0, maximum: 1 }
    
    - name: metadata
      type: object
      properties:
        processing_time_ms: { type: integer }
        sources_consulted: { type: integer }
        reasoning_strategy_used: { type: string }
  
  # Capability advertisement (A2A-inspired)
  capabilities:
    name: "Research Synthesizer"
    version: "1.2.0"
    description: "Synthesizes multi-source research into structured reports"
    supported_domains: [technology, finance, healthcare]
    max_input_tokens: 100000
    avg_response_time: "15s"
    languages: [en, fr, de]
```

### 5.2 Contract Validation Modes

```yaml
contracts:
  validation:
    mode: strict               # strict | warn | permissive
    # strict: reject non-conforming input/output at runtime
    # warn: log warnings but continue processing
    # permissive: best-effort, no enforcement
    
    on_input_violation: reject  # reject | coerce | warn
    on_output_violation: retry  # retry | warn | escalate
```

---

## 6. Quality Gates

Quality gates define cross-cutting verification rules that apply globally or to specific steps.

### 6.1 Global Quality Gates

```yaml
quality_gates:
  # Pre-output checks (run before any step produces final output)
  pre_output:
    - name: factual_grounding
      check: "{{ output.citations.length > 0 || output.reasoning_shown == true }}"
      message: "All claims must be grounded in citations or explicit reasoning"
      severity: error          # error | warning | info
    
    - name: confidence_floor
      check: "{{ output.confidence >= 0.5 }}"
      message: "Output confidence too low for delivery"
      severity: error
      on_fail: escalate
    
    - name: bias_check
      check: "{{ output.perspectives_considered >= 2 }}"
      message: "Consider multiple perspectives before concluding"
      severity: warning
  
  # Post-output checks (run after output, can trigger revision)
  post_output:
    - name: consistency_check
      check: "{{ !output.contradicts_previous }}"
      message: "Output contradicts earlier findings"
      on_fail: revise
    
    - name: format_compliance
      check: "{{ output.format == contracts.outputs[0].type }}"
      message: "Output format doesn't match contract"
      on_fail: retry
  
  # Invariants (checked continuously during reasoning)
  invariants:
    - name: token_budget
      check: "{{ reasoning.tokens_used < reasoning.thinking_budget * 0.95 }}"
      message: "Approaching token budget limit"
      on_breach: summarize_and_conclude
    
    - name: iteration_guard
      check: "{{ reasoning.current_iteration < reasoning.max_iterations }}"
      message: "Max iterations reached"
      on_breach: force_output
```

### 6.2 Self-Verification Loops

```yaml
quality_gates:
  self_verification:
    enabled: true
    strategy: reflection       # reflection | rubric | checklist | critic
    
    # Reflection: agent reviews its own output
    reflection:
      prompt: |
        Review your output against these criteria:
        1. Are all claims supported by evidence?
        2. Have you considered alternative interpretations?
        3. Is the confidence score justified?
      max_revisions: 2
    
    # Rubric: score against defined criteria
    rubric:
      criteria:
        - name: accuracy
          weight: 0.4
          description: "Claims are factually correct and well-sourced"
        - name: completeness
          weight: 0.3
          description: "All aspects of the query are addressed"
        - name: clarity
          weight: 0.2
          description: "Output is clear and well-structured"
        - name: actionability
          weight: 0.1
          description: "Output provides actionable next steps"
      minimum_score: 0.7
    
    # Checklist: binary pass/fail items
    checklist:
      - "Output includes at least 3 sources"
      - "No unsupported speculative claims"
      - "Confidence score is between 0 and 1"
      - "Summary is under 500 words"
```

---

## 7. Decision Trees

For complex conditional routing, LOGIC.md supports inline decision tree definitions.

```yaml
decision_trees:
  input_classifier:
    description: "Route input to appropriate processing pipeline"
    root: check_type
    nodes:
      check_type:
        condition: "{{ input.type }}"
        branches:
          - value: "question"
            next: check_complexity
          - value: "command"
            next: execute_command
          - value: "conversation"
            next: casual_response
          - default: true
            next: clarify_intent
      
      check_complexity:
        condition: "{{ input.estimated_tokens > 1000 || input.requires_research }}"
        branches:
          - value: true
            next: deep_research    # maps to a step name
          - value: false
            next: quick_answer     # maps to a step name
      
      execute_command:
        condition: "{{ input.command_type }}"
        branches:
          - value: "create"
            next: create_pipeline
          - value: "modify"
            next: modify_pipeline
          - value: "delete"
            next: confirm_then_delete
          - default: true
            next: unknown_command

    # Terminal nodes map to step names or inline actions
    terminals:
      clarify_intent:
        action: request_clarification
        message: "I'm not sure what you're asking. Could you rephrase?"
      
      unknown_command:
        action: escalate
        message: "Unrecognized command type"
```

---

## 8. Fallback & Escalation

```yaml
fallback:
  # Global fallback strategy
  strategy: graceful_degrade   # graceful_degrade | escalate | abort | retry_different
  
  # Escalation chain
  escalation:
    - level: 1
      trigger: "{{ confidence < 0.5 }}"
      action: retry_with_different_strategy
      new_strategy: tot        # switch from default to Tree-of-Thoughts
    
    - level: 2
      trigger: "{{ attempts >= 3 && confidence < 0.5 }}"
      action: request_human_review
      message: "Unable to reach sufficient confidence after 3 attempts"
      include_reasoning_trace: true
    
    - level: 3
      trigger: "{{ attempts >= 5 }}"
      action: abort
      message: "Maximum attempts exhausted"
  
  # Graceful degradation rules
  degradation:
    - when: "tools_unavailable"
      fallback_to: reasoning_only
      message: "External tools unavailable, proceeding with knowledge-based reasoning"
    
    - when: "timeout_exceeded"
      fallback_to: partial_output
      include_fields: [summary, confidence_score]
      exclude_fields: [detailed_findings, citations]
```

---

## 9. Composition Patterns

### 9.1 Workflow-Level LOGIC.md

In multi-agent systems, a workflow-level LOGIC.md defines cross-cutting concerns:

```yaml
# workflow.logic.md
spec_version: "1.0"
name: "research-pipeline"
description: "End-to-end research workflow"

# Global constraints applied to all nodes
global:
  max_total_time: "300s"
  max_total_cost: 0.50          # USD
  fail_fast: false              # continue other branches on failure
  max_parallelism: 3

# Node-specific overrides
nodes:
  researcher:
    logic_ref: "./nodes/researcher.logic.md"
    overrides:
      reasoning.max_iterations: 5
      quality_gates.pre_output[0].severity: warning  # downgrade for this node
  
  synthesizer:
    logic_ref: "./nodes/synthesizer.logic.md"
    depends_on: [researcher]
    overrides:
      contracts.inputs[0].required: true

# Inter-node data flow contracts
edges:
  - from: researcher
    to: synthesizer
    contract:
      type: object
      required: [findings]
      properties:
        findings: { type: array, minItems: 1 }
    on_contract_violation: retry_source  # retry_source | skip | abort
```

### 9.2 Node-Level LOGIC.md

Each agent/plugin ships with a default LOGIC.md:

```yaml
# nodes/researcher.logic.md
spec_version: "1.0"
name: "researcher"
description: "Source gathering and evaluation agent"

reasoning:
  strategy: react
  max_iterations: 10

steps:
  search:
    instructions: |
      Search for sources relevant to the query.
      Prioritize: peer-reviewed > official reports > news > blogs > forums.
      Minimum 3 independent sources required.
    output_schema:
      type: object
      required: [sources]
      properties:
        sources:
          type: array
          minItems: 3
          items:
            type: object
            required: [url, title, credibility_score]
  
  evaluate:
    needs: [search]
    instructions: |
      Evaluate each source for:
      - Recency (prefer last 12 months)
      - Authority (domain expertise of author/publication)
      - Corroboration (claims supported by other sources)
      Assign a credibility score 0.0-1.0 to each.

contracts:
  inputs:
    - name: query
      type: string
      required: true
  outputs:
    - name: evaluated_sources
      type: array
      items:
        type: object
        required: [url, title, credibility_score, key_findings]

quality_gates:
  pre_output:
    - name: source_diversity
      check: "{{ output.unique_domains.length >= 2 }}"
      message: "Sources must come from at least 2 different domains"
```

---

## 10. Visual Builder Integration

For visual node-based agent builders (Modular9, Flowise, Dify, n8n-style):

### 10.1 Node Registration

```yaml
# How a visual builder discovers and renders LOGIC.md
visual:
  icon: "brain"                        # icon identifier
  category: "reasoning"                # palette category
  color: "#6366F1"                     # node color
  
  # Configurable parameters exposed in the node inspector panel
  inspector:
    - key: reasoning.strategy
      label: "Reasoning Strategy"
      type: select
      options: [cot, react, tot, got, plan-execute]
      default: react
    
    - key: reasoning.max_iterations
      label: "Max Iterations"
      type: number
      min: 1
      max: 50
      default: 8
    
    - key: quality_gates.self_verification.enabled
      label: "Enable Self-Verification"
      type: boolean
      default: true
    
    - key: confidence.minimum
      label: "Minimum Confidence"
      type: slider
      min: 0
      max: 1
      step: 0.05
      default: 0.6
  
  # Port definitions for visual wiring
  ports:
    inputs:
      - name: query
        type: string
        required: true
      - name: context
        type: object
        required: false
    outputs:
      - name: result
        type: object
      - name: confidence
        type: number
      - name: reasoning_trace
        type: array
```

### 10.2 Runtime Injection

LOGIC.md compiles into prompt context at runtime:

```
┌─────────────────────────────────────────────┐
│ System Prompt (from CLAUDE.md / SOUL.md)    │  ← Identity layer
├─────────────────────────────────────────────┤
│ LOGIC.md Reasoning Scaffold                 │  ← Reasoning layer (NEW)
│  - Strategy instructions                    │
│  - Step-specific reasoning guidance         │
│  - Quality gate rules                       │
│  - Output schema expectations               │
├─────────────────────────────────────────────┤
│ SKILL.md / Tool Definitions                 │  ← Capability layer
├─────────────────────────────────────────────┤
│ User Message / Task Input                   │  ← Task layer
└─────────────────────────────────────────────┘
```

The reasoning scaffold is injected as a **middleware block** between identity and task — NOT wrapping the entire prompt.

---

## 11. Complete Example

```yaml
---
spec_version: "1.0"
name: "competitive-analyst"
description: "Analyzes competitive landscape with structured reasoning"

imports:
  - ref: "./shared/retry-defaults.logic.md"
    as: retry

reasoning:
  strategy: react
  max_iterations: 12
  thinking_budget: 8000

steps:
  identify_competitors:
    description: "Identify and list key competitors in the target space"
    instructions: |
      Search for companies operating in the same market segment.
      Include both direct competitors (same product category) and
      indirect competitors (different product, same problem).
      Minimum 5 competitors required for meaningful analysis.
    output_schema:
      type: object
      required: [competitors]
      properties:
        competitors:
          type: array
          minItems: 5
          items:
            type: object
            required: [name, category, url]
            properties:
              name: { type: string }
              category: { enum: [direct, indirect] }
              url: { type: string, format: uri }
              funding: { type: string }
              employee_count: { type: integer }
    allowed_tools: [web_search]
    timeout: "60s"

  analyze_features:
    needs: [identify_competitors]
    description: "Build feature comparison matrix"
    instructions: |
      For each competitor, analyze their product features.
      Focus on: pricing model, core capabilities, integrations,
      target market, and unique differentiators.
      Cross-reference with at least 2 sources per competitor.
    branches:
      - if: "{{ steps.identify_competitors.output.competitors.length > 10 }}"
        then: prioritize_top_10
      - default: true
        then: deep_analysis

  synthesize:
    needs: [analyze_features]
    description: "Produce final competitive analysis report"
    instructions: |
      Synthesize findings into a structured report.
      Lead with the most actionable insight.
      Identify 3-5 positioning opportunities.
      Flag any data gaps or low-confidence assessments.
    verification:
      check: "{{ output.opportunities.length >= 3 && output.confidence >= 0.7 }}"
      on_fail: retry

contracts:
  inputs:
    - name: market_segment
      type: string
      required: true
    - name: our_product
      type: object
      required: true
      properties:
        name: { type: string }
        features: { type: array, items: { type: string } }
  
  outputs:
    - name: analysis
      type: object
      required: [competitors, feature_matrix, opportunities, confidence]

quality_gates:
  pre_output:
    - name: minimum_competitors
      check: "{{ output.competitors.length >= 5 }}"
      severity: error
    - name: evidence_grounding
      check: "{{ output.sources_cited >= output.competitors.length }}"
      severity: warning
  
  self_verification:
    enabled: true
    strategy: checklist
    checklist:
      - "All competitors have at least 2 corroborating sources"
      - "Feature matrix covers pricing, capabilities, and integrations"
      - "Opportunities are specific and actionable, not generic"
      - "Confidence score reflects actual evidence quality"

fallback:
  strategy: graceful_degrade
  escalation:
    - level: 1
      trigger: "{{ confidence < 0.5 }}"
      action: request_human_review
      message: "Competitive analysis confidence below threshold — human review recommended"

metadata:
  author: "Single Source Studios"
  created: "2026-03-31"
  tags: [competitive-analysis, research, business-intelligence]
---

# Competitive Analyst — Reasoning Documentation

## Strategy Rationale

ReAct is chosen because competitive analysis requires interleaved search
(Action) and evaluation (Thought). Pure CoT would reason from stale
training data; pure tool-use would collect without evaluating.

## Source Prioritization

1. Company websites and official documentation (highest authority)
2. Crunchbase, PitchBook, LinkedIn (funding, headcount)
3. G2, Capterra reviews (user perspective)
4. Industry analyst reports (market context)
5. Blog posts, podcasts (supplementary only)

## Known Failure Modes

- **Stealth-mode startups**: May not appear in web search. Mitigated by
  also searching ProductHunt, HackerNews, and AngelList.
- **Outdated pricing**: SaaS pricing changes frequently. Always note
  the date of last verification.
- **Feature parity assumptions**: Don't assume similar feature names
  mean similar implementations. Note "unverified" where needed.
```

---

## 12. JSON Schema (for Validators)

A complete JSON Schema for LOGIC.md validation is available at:
`https://github.com/logic-md/spec/schema/v1.0/logic.schema.json`

Validators should:
1. Extract YAML frontmatter from between `---` delimiters
2. Parse YAML to JSON
3. Validate against the JSON Schema
4. Report errors with line numbers mapping to the original .md file

---

## 13. File Naming & Discovery

| Pattern | Scope |
|---------|-------|
| `LOGIC.md` | Root-level default for entire project |
| `*.logic.md` | Named reasoning configs (e.g., `researcher.logic.md`) |
| `.logic/` | Directory for complex multi-file configs |
| `.logic/index.md` | Entry point when using directory structure |

Visual builders should scan for `*.logic.md` files in plugin/node directories and auto-register them.

---

## 14. Versioning & Migration

LOGIC.md files include `spec_version` for forward compatibility. Parsers MUST:
- Accept any `spec_version` they support
- Reject (with clear error) versions they don't support
- Never silently ignore unknown properties (warn instead)

### 14.1 Spec Versioning Contract

The specification version (`spec_version` field) follows semantic versioning at the spec level, independent of any implementation's package version:

**Minor versions** (1.1, 1.2, etc.) are strictly additive. A file valid under spec 1.0 MUST be valid under any 1.x parser. Minor versions MAY add new optional properties, new enum values to existing enums, or new definition types. They MUST NOT remove properties, change property types, or add new required fields.

**Major versions** (2.0, etc.) MAY introduce breaking changes: removing properties, renaming fields, changing type constraints, or adding new required fields. Major version bumps MUST include migration documentation and SHOULD include automated migration tooling.

### 14.2 Spec Version vs Implementation Version

A LOGIC.md implementation (parser, validator, compiler) has its own version (e.g., `@logic-md/core@1.4.0`). The spec version it supports is declared separately. An implementation MUST declare which spec versions it supports. The reference implementation at `@logic-md/core` supports spec version 1.0.

---

## 15. Conformance

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### 15.1 Parser Conformance

A conformant LOGIC.md parser:

1. **MUST** extract YAML frontmatter from between `---` delimiters
2. **MUST** parse the YAML to a data structure
3. **MUST** validate the parsed data against the canonical JSON Schema (`spec/schema.json`)
4. **MUST** reject files missing the required `spec_version` and `name` properties
5. **MUST** reject files with `spec_version` values the implementation does not support
6. **MUST NOT** silently discard unknown properties — implementations MUST either reject them (if the schema specifies `additionalProperties: false`) or emit a warning
7. **SHOULD** report validation errors with paths mapping to the original YAML structure
8. **MAY** parse the markdown body for informational use but MUST NOT require it for validation

### 15.2 Compiler Conformance

A conformant LOGIC.md compiler (optional — not all implementations need one):

1. **MUST** resolve step DAGs using topological sort and detect cycles
2. **MUST** compute parallel execution levels for steps with no dependency relationship
3. **SHOULD** generate prompt segments that include execution mandates when output contracts are present
4. **SHOULD** inject quality gate rules into the generated context

### 15.3 Conformance Test Suite

The canonical conformance test suite is located at `spec/fixtures/`. It contains:

- `valid/` — Files that MUST parse and validate successfully
- `invalid/` — Files that MUST fail validation with errors at specified paths
- `edge-cases/` — Files testing boundary conditions

Each fixture consists of a `.logic.md` input file paired with an `.expected.json` result file. Any implementation in any language can verify conformance by running all fixtures and comparing results.

An implementation is conformant if:
- All `valid/` fixtures parse and validate without errors
- All `invalid/` fixtures produce at least one error at the path specified in the expected result
- All `edge-cases/` fixtures produce the result documented in their expected file

---

## 16. Discovery

### 16.1 File Naming Conventions

| Pattern | Scope |
|---------|-------|
| `LOGIC.md` | Root-level default for entire project |
| `*.logic.md` | Named reasoning configs (e.g., `researcher.logic.md`) |
| `.logic/` | Directory for complex multi-file configs |
| `.logic/index.md` | Entry point when using directory structure |

Visual builders SHOULD scan for `*.logic.md` files in plugin/node directories and auto-register them.

### 16.2 Project Discovery

Agents and tools that want to discover LOGIC.md specs in a project SHOULD look in this order:

1. `LOGIC.md` at the project root
2. `*.logic.md` in the project root
3. `.logic/` directory
4. `*.logic.md` in subdirectories (recursive)

### 16.3 Agent Capability Advertisement

A LOGIC.md file with a `contracts` section is a capability advertisement. It declares:

- **What the agent accepts** (`contracts.inputs`)
- **What the agent produces** (`contracts.outputs`)
- **How reliably** (`quality_gates`, `fallback`)
- **Through what reasoning process** (`reasoning`, `steps`)

When two agents' contracts align — Agent A's `contracts.outputs` structurally satisfies Agent B's `contracts.inputs` — they can compose. This pattern mirrors the capability advertisement in the A2A protocol's Agent Card, but expressed as a portable file rather than a runtime endpoint.

---

## License

This specification is released under **MIT License**.
Free to use, modify, distribute — commercially or otherwise.
Attribution appreciated but not required.
