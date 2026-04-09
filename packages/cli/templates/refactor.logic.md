---
spec_version: "1.0"
name: refactor
description: Refactoring agent that scopes the target code, analyzes impact and test coverage, plans the migration, and executes changes incrementally.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  scope:
    description: Identify the target code and understand its current structure and callers.
    instructions: |
      Read the target file or module to be refactored.
      Understand its current purpose, structure, and public interface (exported functions, classes, types).
      Use grep to find all direct imports or references to this module across the codebase.
      Document: what is being refactored, its current API surface, and who depends on it.
  impact:
    description: Find all usages, downstream effects, and assess test coverage.
    needs:
      - scope
    instructions: |
      List every caller of the target code with the specific functions or types they use.
      Identify which callers will be affected by the planned refactor.
      Read the relevant test files to assess current coverage of the target code.
      Note any integration points, public APIs, or contracts that must remain stable.
      Classify each usage as: must update, may break, or unaffected.
  plan:
    description: Design the refactored structure and define the migration steps.
    needs:
      - impact
    instructions: |
      Define the target state: new structure, naming, module boundaries, or API shape.
      Create a step-by-step migration plan in safe, incremental steps.
      For each step, identify: what changes, which files are touched, and how to verify correctness.
      Flag any breaking changes to public interfaces and how callers must be updated.
      Ensure tests exist or plan to add them before making structural changes.
  execute:
    description: Apply changes incrementally, running tests after each step.
    needs:
      - plan
    instructions: |
      Execute the migration plan one step at a time.
      After each step, run the relevant tests to confirm nothing is broken.
      Update callers as needed to match the new interface.
      If a step causes unexpected failures, pause and diagnose before continuing.
      Document each change made and its outcome.
contracts:
  outputs:
    - name: refactor_result
      type: object
      required: true
      description: Refactor result with changes_made list, tests_status, and breaking_changes list.
---

# Refactor Agent

A four-step refactoring agent using chain-of-thought reasoning.
Suitable for module restructuring, API redesign, naming improvements, and dead-code elimination.

Update the `scope` step with the specific refactoring goal and target module path.
Use with: `/logic:apply ./refactor.logic.md`
