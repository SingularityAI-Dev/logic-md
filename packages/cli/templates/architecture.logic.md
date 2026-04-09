---
spec_version: "1.0"
name: architecture
description: Architecture decision agent that explores options using tree-of-thought, evaluates tradeoffs, and produces a structured ADR.
reasoning:
  strategy: tot
  max_iterations: 3
steps:
  context:
    description: Understand the problem, constraints, and requirements driving the decision.
    instructions: |
      Clearly state the architectural problem or decision that needs to be made.
      List the functional requirements: what the solution must do.
      List the constraints: performance targets, team skills, existing infrastructure, budget, timeline.
      Identify stakeholders and their priorities.
      Define the decision criteria: what does a good solution look like?
  explore:
    description: Generate 2-3 distinct architectural options with their tradeoffs.
    needs:
      - context
    instructions: |
      Generate at least 2 and at most 3 meaningfully different architectural options.
      For each option, describe: the approach, key components, and how it satisfies the requirements.
      List the tradeoffs for each: pros (strengths, fits constraints), cons (weaknesses, risks).
      Consider: implementation complexity, operational overhead, team familiarity, future flexibility.
      Keep options genuinely distinct — avoid variations on the same theme.
  evaluate:
    description: Compare options against constraints using a decision matrix.
    needs:
      - explore
    instructions: |
      Create a decision matrix: rows are options, columns are criteria from the context step.
      Score each option against each criterion (1-5 or Low/Medium/High).
      Weight criteria by importance if some are more critical than others.
      Identify the option with the best overall fit, and note any disqualifying factors.
      Document any assumptions made in the evaluation.
  decide:
    description: Select the best option and write a structured Architecture Decision Record.
    needs:
      - evaluate
    instructions: |
      State the selected option and the primary reasons for choosing it over alternatives.
      Write an ADR with sections: Title, Status (Proposed), Context, Decision, Rationale, Alternatives Considered, Consequences.
      List consequences: positive outcomes expected, negative tradeoffs accepted, and open questions.
      Identify the next steps to implement the decision.
contracts:
  outputs:
    - name: adr
      type: object
      required: true
      description: Architecture Decision Record with decision, rationale, alternatives_considered, and consequences.
---

# Architecture Decision Agent

A four-step architecture decision agent using tree-of-thought reasoning.
Suitable for technology selection, system design, API design, and infrastructure decisions.

Update the `context` step with the specific decision to be made and relevant constraints.
The output ADR can be saved directly as a markdown file in your `docs/decisions/` directory.

Use with: `/logic:apply ./architecture.logic.md`
