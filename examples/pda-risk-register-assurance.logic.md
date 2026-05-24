---
spec_version: "1.0"
name: "pda-risk-register-assurance"
description: "Eight-step audit-trail-preserving assurance workflow that ingests a project delivery artefact, extracts and scores risks, gates significant findings through human review, and persists with full provenance. Designed as a public-sector reference example."

reasoning:
  strategy: plan-execute
  max_iterations: 16
  temperature: 0.2
  thinking_budget: 24000

steps:
  ingest_artefact:
    description: "Read the project delivery artefact and produce a normalised internal representation"
    instructions: |
      Parse the input artefact (PDF / XLSX / JSON / CSV) into a normalised
      structure. Extract section headings and their contents, preserving the
      byte offset of every section so downstream extracted claims can be
      cited back to source.
    allowed_tools: [document_reader, spreadsheet_parser]
    denied_tools: [llm_completion, assurance_store_write, web_search]
    timeout: "60s"
    confidence:
      minimum: 0.95
      target: 1.0
      escalate_below: 0.85
    output_schema:
      type: object
      required: [artefact_id, format, sections, provenance]
      properties:
        artefact_id:
          type: string
        format:
          type: string
          enum: [pdf, xlsx, json, csv]
        sections:
          type: array
          minItems: 1
          items:
            type: object
            required: [heading, body, byte_offset]
            properties:
              heading: { type: string }
              body: { type: string }
              byte_offset: { type: integer, minimum: 0 }
        provenance:
          type: object
          required: [step_chain, source_artefact_id, timestamp]
          properties:
            step_chain: { type: array, items: { type: string } }
            source_artefact_id: { type: string }
            timestamp: { type: string, format: date-time }

  validate_artefact:
    needs: [ingest_artefact]
    description: "Structural validation against the canonical project-data schema"
    instructions: |
      Validate the parsed artefact. Required sections: executive_summary,
      risk_register, cost_baseline, schedule_baseline. Report the validation
      verdict and any missing or malformed fields. This step is deterministic;
      no LLM tooling is permitted.
    allowed_tools: [schema_validator]
    denied_tools: [llm_completion, assurance_store_write, web_search]
    verification:
      check: "{{ output.valid == true }}"
      on_fail: abort
      on_fail_message: "Artefact failed structural validation; assurance run aborted"
    output_schema:
      type: object
      required: [valid, missing_required_fields, validation_errors, provenance]
      properties:
        valid: { type: boolean }
        missing_required_fields:
          type: array
          items: { type: string }
        validation_errors:
          type: array
          items:
            type: object
        provenance:
          type: object
          required: [step_chain, timestamp]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }

  extract_risks:
    needs: [validate_artefact]
    description: "Extract candidate risks with severity, likelihood, and source citations"
    instructions: |
      From the risk register and any narrative mentioning risk, threat, issue,
      dependency, or assumption, extract candidate risk items. For each:
      - risk_id (stable identifier; deterministic — e.g. SHA-256 of
        title + cited_byte_offset, truncated to 12 hex chars. Must be unique
        within this run and reproducible across reruns of the same artefact.)
      - title (short, imperative)
      - description (one sentence)
      - severity (1-5)
      - likelihood (1-5)
      - cited_byte_offset (back-reference into ingest_artefact.sections[].byte_offset)
      - confidence (0-1)
      Do not invent risks not grounded in the source. If the artefact is
      ambiguous, mark confidence below 0.5 rather than fabricating clarity.
      Downstream steps (outlier_scan, triage, human_review_gate, emit_report)
      join on risk_id; it is the contract key for cross-step correlation.
    allowed_tools: [llm_completion, knowledge_base_search]
    denied_tools: [assurance_store_write, web_search, document_reader]
    confidence:
      minimum: 0.7
      target: 0.85
      escalate_below: 0.5
    retry:
      max_attempts: 3
      initial_interval: "2s"
      backoff_coefficient: 2.0
      maximum_interval: "30s"
    output_schema:
      type: object
      required: [risks, average_confidence, provenance]
      properties:
        risks:
          type: array
          items:
            type: object
            required: [risk_id, title, description, severity, likelihood, cited_byte_offset, confidence]
            properties:
              risk_id:
                type: string
                pattern: "^[a-f0-9]{12}$"
                description: "Stable deterministic identifier (e.g. SHA-256 of title + cited_byte_offset, truncated to 12 hex chars). Used as the join key by all downstream steps."
              title: { type: string }
              description: { type: string }
              severity: { type: integer, minimum: 1, maximum: 5 }
              likelihood: { type: integer, minimum: 1, maximum: 5 }
              cited_byte_offset: { type: integer, minimum: 0 }
              confidence: { type: number, minimum: 0, maximum: 1 }
        average_confidence:
          type: number
          minimum: 0
          maximum: 1
        provenance:
          type: object
          required: [step_chain, timestamp, confidence]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }
            confidence: { type: number, minimum: 0, maximum: 1 }

  outlier_scan:
    needs: [extract_risks]
    description: "Compare extracted risks against historical baseline patterns"
    instructions: |
      For each extracted risk, query the assurance store for similar items in
      previous projects in the same domain. Flag any risk that:
      - Has no historical analogue (novel risk)
      - Has unusually high or low severity vs analogues
      - Matches a pattern that historically preceded major project failures
      Read-only access. No mutation of the assurance store from this step.
    allowed_tools: [assurance_store_read, knowledge_base_search]
    denied_tools: [llm_completion, assurance_store_write, web_search]
    output_schema:
      type: object
      required: [outliers, baseline_size, provenance]
      properties:
        outliers:
          type: array
          items:
            type: object
            required: [risk_id, outlier_type, baseline_severity, observed_severity]
            properties:
              risk_id: { type: string }
              outlier_type:
                type: string
                enum: [novel, severity_high, severity_low, failure_pattern_match]
              baseline_severity: { type: number, minimum: 0, maximum: 5 }
              observed_severity: { type: number, minimum: 0, maximum: 5 }
        baseline_size: { type: integer, minimum: 0 }
        provenance:
          type: object
          required: [step_chain, timestamp]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }

  triage:
    needs: [outlier_scan]
    description: "Per-risk triage decision: auto-approve, flag for review, or escalate"
    instructions: |
      For each risk in extract_risks.risks:
      - If severity * likelihood < 6 AND not flagged as outlier: auto_approve
      - If severity * likelihood >= 9 OR flagged as failure_pattern_match outlier: escalate
      - Otherwise: flag_for_review
      Justify each decision in one sentence referencing the relevant source
      citation and outlier scan result.
    allowed_tools: [llm_completion, assurance_store_read]
    denied_tools: [assurance_store_write, web_search]
    confidence:
      minimum: 0.7
      target: 0.85
      escalate_below: 0.5
    output_schema:
      type: object
      required: [triage_decisions, escalations_count, provenance]
      properties:
        triage_decisions:
          type: array
          items:
            type: object
            required: [risk_id, decision, rationale]
            properties:
              risk_id: { type: string }
              decision:
                type: string
                enum: [auto_approve, flag_for_review, escalate]
              rationale: { type: string }
        escalations_count:
          type: integer
          minimum: 0
        provenance:
          type: object
          required: [step_chain, timestamp, confidence]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }
            confidence: { type: number, minimum: 0, maximum: 1 }

  human_review_gate:
    needs: [triage]
    description: "First-class human review checkpoint — workflow halts until SRO or assurance lead decides"
    instructions: |
      Present the triage decisions to a designated reviewer (SRO or assurance
      lead per project governance). The reviewer issues a single overall
      decision and per-risk decisions for any escalated items.

      This step performs no LLM action. Its only callable tool is
      `human_review_request`. The workflow cannot proceed past this step
      without an explicit decision being recorded.
    allowed_tools: [human_review_request]
    denied_tools: [llm_completion, assurance_store_write, web_search, document_reader, knowledge_base_search]
    timeout: "72h"
    verification:
      check: "{{ output.decision != null && output.reviewer_id != null }}"
      on_fail: abort
      on_fail_message: "human_review_gate cannot be bypassed; a reviewer_id and decision are required"
    output_schema:
      type: object
      required: [decision, reviewer_id, decision_timestamp, per_risk_decisions, provenance]
      properties:
        decision:
          type: string
          enum: [approved, rejected, request_changes, deferred]
        reviewer_id: { type: string }
        decision_timestamp: { type: string, format: date-time }
        per_risk_decisions:
          type: array
          items:
            type: object
            required: [risk_id, reviewer_decision]
            properties:
              risk_id: { type: string }
              reviewer_decision:
                type: string
                enum: [approved, rejected, request_changes, deferred]
              comment: { type: string }
        provenance:
          type: object
          required: [step_chain, timestamp, reviewer_id]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }
            reviewer_id: { type: string }

  persist:
    needs: [human_review_gate]
    description: "Write the triaged risk register to the assurance store with full provenance"
    instructions: |
      Persist the approved risk register. The stored record must include:
      - Per-risk source citation (byte offset into ingest_artefact)
      - The full provenance chain (every step that contributed)
      - Reviewer ID and timestamp from human_review_gate
      - A summary of the reasoning trace
      Write-only access. No reads of any other system from this step.
    allowed_tools: [assurance_store_write]
    denied_tools: [llm_completion, web_search, document_reader, knowledge_base_search]
    verification:
      check: "{{ output.stored_id != null }}"
      on_fail: retry
      on_fail_message: "Persistence to assurance store did not return a stored_id"
    output_schema:
      type: object
      required: [stored_id, write_timestamp, provenance]
      properties:
        stored_id: { type: string }
        write_timestamp: { type: string, format: date-time }
        provenance:
          type: object
          required: [step_chain, timestamp, source_artefact_id, reviewer_id]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }
            source_artefact_id: { type: string }
            reviewer_id: { type: string }

  emit_report:
    needs: [persist]
    description: "Generate the structured assurance report for the project board"
    instructions: |
      Produce a Markdown report for the project board containing:
      - Executive summary (max 200 words)
      - Top-5 risks by severity * likelihood product
      - Outliers requiring escalation (if any)
      - Provenance trail (artefact_id, processing_timestamp, reviewer_id)
      - Overall confidence score for the assurance run
      Reference all claims back to byte offsets in the original artefact.
    allowed_tools: [llm_completion, report_renderer]
    denied_tools: [assurance_store_write, web_search, document_reader]
    output_schema:
      type: object
      required: [report_markdown, summary, top_risks, provenance]
      properties:
        report_markdown: { type: string }
        summary:
          type: string
          maxLength: 1500
        top_risks:
          type: array
          maxItems: 5
          items:
            type: object
            required: [risk_id, title, severity, likelihood]
        provenance:
          type: object
          required: [step_chain, timestamp, source_artefact_id, reviewer_id, confidence]
          properties:
            step_chain: { type: array, items: { type: string } }
            timestamp: { type: string, format: date-time }
            source_artefact_id: { type: string }
            reviewer_id: { type: string }
            confidence: { type: number, minimum: 0, maximum: 1 }

contracts:
  inputs:
    - name: artefact_uri
      type: string
      required: true
      description: "URI of the project delivery artefact to ingest"
      constraints:
        max_length: 500
    - name: project_id
      type: string
      required: true
      description: "Identifier of the project being assured"
    - name: assurance_run_id
      type: string
      required: true
      description: "Unique identifier for this assurance run, used in provenance"
  outputs:
    - name: assurance_record
      type: object
      required: [stored_id, report_markdown, decision, provenance]
      properties:
        stored_id:
          type: string
        report_markdown:
          type: string
        decision:
          type: string
          enum: [approved, rejected, request_changes, deferred]
        provenance:
          type: object
          required: [step_chain, source_artefact_id, reviewer_id, confidence]
          properties:
            step_chain:
              type: array
              items: { type: string }
              description: "Ordered list of steps that contributed to the final output"
            source_artefact_id:
              type: string
            reviewer_id:
              type: string
              description: "ID of the human reviewer who acted at human_review_gate"
            confidence:
              type: number
              minimum: 0
              maximum: 1
  validation:
    mode: strict
    on_input_violation: reject
    on_output_violation: escalate
  capabilities:
    name: "PDA Risk Register Assurance"
    version: "1.0.0"
    description: "Audit-trail-preserving risk extraction and assurance for project delivery artefacts"
    supported_domains: [public_sector_assurance, project_delivery]
    max_input_tokens: 200000
    avg_response_time: "180s"

quality_gates:
  pre_output:
    - name: provenance_intact
      check: "{{ output.provenance.step_chain.length >= 5 }}"
      message: "Provenance chain must include at least 5 contributing steps"
      severity: error
      on_fail: abort
    - name: human_reviewer_recorded_when_approved
      check: "{{ output.decision != 'approved' || output.provenance.reviewer_id != null }}"
      message: "Approved decisions must record a reviewer_id"
      severity: error
      on_fail: abort
    - name: confidence_floor
      check: "{{ output.provenance.confidence >= 0.5 }}"
      message: "Final confidence below assurance floor"
      severity: error
      on_fail: escalate
  post_output:
    - name: decision_recorded
      check: "{{ output.decision != null }}"
      message: "Workflow must record an explicit decision"
      severity: error
      on_fail: abort
  invariants:
    - name: persist_only_after_review
      check: "{{ steps.persist.completed == false || steps.human_review_gate.completed == true }}"
      message: "persist may only execute after human_review_gate completes"
      on_breach: abort
  self_verification:
    enabled: true
    strategy: rubric
    rubric:
      criteria:
        - name: source_grounding
          weight: 0.30
          description: "Every risk traces back to a cited byte offset in the source artefact"
        - name: provenance_completeness
          weight: 0.25
          description: "Provenance includes step_chain, timestamps, source_artefact_id, and reviewer_id"
        - name: outlier_explanation
          weight: 0.20
          description: "Each escalated risk has a rationale referencing the outlier scan result"
        - name: human_review_compliance
          weight: 0.15
          description: "Escalated risks were reviewed; auto-approved risks meet the severity threshold"
        - name: report_clarity
          weight: 0.10
          description: "Final report is structured, cites sources, and gives an executive summary"
      minimum_score: 0.75

fallback:
  strategy: escalate
  escalation:
    - level: 1
      trigger: "{{ confidence < 0.5 }}"
      action: retry_with_different_strategy
      new_strategy: tot
    - level: 2
      trigger: "{{ attempts >= 3 && confidence < 0.5 }}"
      action: request_human_review
      message: "Unable to reach assurance threshold after 3 attempts"
      include_reasoning_trace: true
    - level: 3
      trigger: "{{ attempts >= 5 }}"
      action: abort
      message: "Maximum attempts exhausted; assurance run failed without persisting partial output"

metadata:
  author: "Ant Newman <antjsnewman@outlook.com>"
  created: "2026-05-05"
  tags: [assurance, public-sector, risk-register, project-delivery, regulated-domain]
  inspired_by:
    - "UK Cabinet Office IPA assurance gates"
    - "PRINCE2 risk-register pattern"
---

# PDA Risk Register Assurance — Reasoning Documentation

## Purpose

This worked example documents an eight-step assurance workflow for processing
a UK-government project delivery artefact (a periodic report, business case,
or PRINCE2 product description). The output is a triaged risk register
written to an assurance store with a full provenance trail suitable for
board-level review and external audit.

The example deliberately stresses four LOGIC.md features simultaneously,
each of which is sparsely covered by existing fixtures and templates:

1. **Rubric-based self-verification** (`quality_gates.self_verification.strategy: rubric`)
2. **Write-segregated per-step `allowed_tools`** — each step can only access
   the tools its role requires; the four-axis segregation (read / no-LLM /
   LLM-with-search / write) is enforceable, not advisory
3. **`human_review_gate` as a first-class step** — not a flag on an LLM step,
   not an action in `fallback.escalation`
4. **Provenance metadata flowing through every step's contract** — the audit
   trail is a typed first-class output, not an afterthought tacked on at the end

## Strategy rationale

`plan-execute` is chosen over ReAct because the workflow's structure is fixed
in advance — a regulated assurance pipeline does not benefit from interleaved
search and reasoning at every step. The DAG is the plan; each step executes
its role. Temperature is held to 0.2: determinism is more valuable than
creativity in assurance work, and reviewers must be able to reproduce results.

## Tool-segregation pattern

The eight steps partition cleanly across five tool families. Every step
declares both `allowed_tools` and (where load-bearing) `denied_tools`. A
runtime that respects the declarations cannot, for example, allow
`extract_risks` to write to the assurance store even if the LLM hallucinates
a tool call.

| Tool family | Steps | Why this segregation |
|---|---|---|
| Read-only document tools | `ingest_artefact` | Byte-level extraction only; no summarisation |
| Schema validators (no LLM) | `validate_artefact` | Validation is deterministic; LLM access denied |
| LLM with knowledge-base search | `extract_risks`, `triage`, `emit_report` | Reasoning steps; explicitly denied write tools and document_reader |
| Read-only assurance store | `outlier_scan` | Compares against history; cannot mutate |
| Human review (no LLM) | `human_review_gate` | Only `human_review_request`; LLM denied |
| Write-only assurance store | `persist` | Only step with write capability; LLM and read-tools denied |

## `human_review_gate` as a first-class step

A common anti-pattern is to model human review as a flag on an LLM step
(e.g. `requires_review: true`) or as an `action` in `fallback.escalation`.
Both approaches lose the structural information that *the workflow halts
here until a human acts*.

Modelling it as a first-class step has three concrete benefits:

1. **DAG visibility** — the step appears in the workflow graph; downstream
   steps explicitly `needs: [human_review_gate]` and a runtime can refuse to
   execute them until the gate completes.
2. **Tool-permission enforcement** — the step's `allowed_tools` is exactly
   `[human_review_request]` and nothing else; LLM access is explicitly
   denied. No automated substitution is possible.
3. **Auditability** — the step has its own contract (`reviewer_id`,
   `decision_timestamp`, `per_risk_decisions`), which becomes part of the
   provenance trail at the same level as every other step's output, viewable
   in the same place.

The gate is a step rather than a `quality_gates.pre_output` check because
quality gates run *during* an LLM step's output cycle; this gate must run
*between* steps and block the DAG.

## Provenance convention

Every step output includes a `provenance` object with consistent fields
(`step_chain`, `timestamp`, plus contextual fields like `confidence`,
`reviewer_id`, `source_artefact_id` where applicable). This is repeated by
convention rather than enforced by a single shared schema fragment — see
[Spec edges encountered](#spec-edges-encountered) below.

The terminal `assurance_record` contract collects the full provenance trail
into the workflow output, where it travels with the persisted record into
the assurance store. A consumer of the assurance record can reconstruct
which steps ran, when, and which human reviewer authorised the persist.

## Failure modes and fallbacks

| Trigger | Behaviour |
|---|---|
| `validate_artefact.output.valid == false` | Verification fails, step `aborts` with a structured message; no LLM cost incurred downstream. |
| `extract_risks.confidence < 0.5` | Retry up to 3 attempts with exponential backoff, then escalate to `tot` strategy. |
| `human_review_gate` exceeds 72h timeout | Step times out; the assurance lead is notified; no auto-approval. |
| Five total retry attempts | Workflow aborts. Failed runs are recorded but no partial output is persisted. |

## Self-verification rubric

The five rubric criteria are weighted to reflect what an external auditor
would check first if asked to verify an assurance record:

- **Source grounding (0.30)** — the most-checked property in audit
- **Provenance completeness (0.25)** — required to defend the record
- **Outlier explanation (0.20)** — defence against rubber-stamping
- **Human review compliance (0.15)** — gate integrity
- **Report clarity (0.10)** — communication, not assurance correctness

`minimum_score: 0.75` reflects that any score below this is below the
threshold an audit would tolerate, not below "perfect."

## Spec edges encountered

These are observations from drafting this example that may inform future
LOGIC.md spec evolution. None block this example's correctness against
v1.0.

1. **No workflow-local `$ref` in `output_schema`.** The `provenance` shape
   would benefit from a single source of truth referenced from each step.
   Today it is repeated by convention. A small `definitions:` block at the
   spec level, addressable from `output_schema` via `$ref`, would help.
2. **`human_review_gate` is implicit in v1.0.** No explicit step type
   distinguishes "this step waits for a human" from a regular instruction
   step. The pattern is encoded entirely via `allowed_tools`,
   `denied_tools`, and `verification`. A first-class step type
   (e.g. `kind: human_gate`) would make runtime gating less error-prone.
3. **Tool-name registry is implicit.** Names like `assurance_store_write`,
   `human_review_request`, and `report_renderer` are conventional in this
   example; nothing in the spec defines a canonical tool taxonomy. A small
   registry pattern (similar to MCP tool naming conventions) would help
   cross-spec interoperability.
4. **Quality-gate invariants reference `steps.<name>.completed`.** This is
   used in `persist_only_after_review`. The expression engine accepts it,
   but the spec text does not document `steps.<name>.completed` as a
   stable variable. Worth confirming.

## Licence

MIT, matching the parent repository. May be used as a reference for any
public-sector or regulated-domain assurance workflow. Suggested attribution:
*"Adapted from logic-md `examples/pda-risk-register-assurance.logic.md`."*
