---
spec_version: "1.0"
name: code-review
description: Structured PR and code review agent that methodically analyzes correctness, style, security, and produces a verdict.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  understand:
    description: Read the PR description, changed files, and surrounding context.
    instructions: |
      Read the PR description and understand the stated intent of the change.
      List all files changed and identify the scope: new feature, bug fix, refactor, or chore.
      For each changed file, read the diff and note what was added, removed, or modified.
      Identify any relevant context: related modules, tests, configuration changes.
  analyze:
    description: Check correctness, edge cases, error handling, and security.
    needs:
      - understand
    instructions: |
      For each changed file, evaluate correctness: does the logic achieve the stated intent?
      Check edge cases: null/undefined inputs, empty collections, boundary values, concurrent access.
      Evaluate error handling: are errors caught, logged, and surfaced appropriately?
      Review security: look for injection risks, unvalidated inputs, exposed secrets, missing auth checks.
      Note each issue with its file, line reference, severity (critical/major/minor), and description.
  assess_style:
    description: Evaluate coding standards, naming conventions, and established patterns.
    needs:
      - analyze
    instructions: |
      Check naming: are variables, functions, and types clearly named and consistent with the codebase?
      Evaluate structure: is the code organized consistently with surrounding modules?
      Assess readability: are complex sections commented or broken into well-named helpers?
      Check for duplication: does this code re-implement something that already exists?
      Add any style issues to the findings list with severity "minor" or "suggestion".
  summarize:
    description: Compile all findings into a structured review report with a verdict.
    needs:
      - assess_style
    instructions: |
      Group all findings by severity: critical, major, minor, suggestion.
      For each finding, provide: file, issue description, and suggested fix.
      Choose a verdict: "approve" (no blockers), "request-changes" (critical or major issues), or "comment" (minor issues only).
      Write a one-paragraph summary of the overall change quality.
contracts:
  outputs:
    - name: review_result
      type: object
      required: true
      description: Review result with verdict (approve/request-changes/comment), issues list, and suggestions.
---

# Code Review Agent

A four-step code review agent using chain-of-thought reasoning.
Suitable for PR reviews, code audits, and pre-merge checks.

Customize the `analyze` step criteria to match your team's standards (e.g., specific security frameworks, performance requirements).
Use with: `/logic:apply ./code-review.logic.md`
