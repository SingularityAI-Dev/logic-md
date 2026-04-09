---
spec_version: "1.0"
name: validator
description: Validation agent that parses input, applies validation rules, and produces a structured validation report.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  parse_input:
    description: Parse and normalise the input data for validation.
    instructions: |
      Read the input data and identify its structure and type.
      Normalise values where required (e.g., trim whitespace, normalise casing).
      Flag any parsing errors or structural issues immediately.
  apply_rules:
    description: Apply all validation rules to the parsed input.
    needs:
      - parse_input
    instructions: |
      Evaluate each validation rule against the parsed data.
      For each rule: record whether it passed or failed, and why.
      List all violations with the field path, expected value, and actual value.
  produce_report:
    description: Compile rule results into a structured validation report.
    needs:
      - apply_rules
    instructions: |
      Summarise the validation outcome: passed, failed, or passed with warnings.
      List all violations with severity and remediation guidance.
      Include counts of passed, failed, and skipped rules.
contracts:
  inputs:
    - name: data
      type: object
      required: true
      description: The data object to validate against the defined rules.
  outputs:
    - name: validation_report
      type: object
      required: true
      description: Validation report containing the outcome, violations, and per-rule results.
---

# Validator Agent

A three-step validation agent with strict input and output contracts.
Suitable for form validation, API request validation, data quality checks, and schema enforcement.

Add your validation rules to the `apply_rules` step instructions.
Define the expected input schema in the `data` input contract.
