---
spec_version: "1.0"
name: extractor
description: Structured data extraction agent that identifies the target schema, extracts data fields, and normalises the output.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  identify_schema:
    description: Determine the target data schema and extraction rules.
    instructions: |
      Read the source content and understand its format and structure.
      Identify the target output schema: field names, types, and constraints.
      Define extraction rules for each field (e.g., regex, position, label).
  extract:
    description: Apply extraction rules to pull values from the source content.
    needs:
      - identify_schema
    instructions: |
      Apply the extraction rules to locate and capture each field value.
      For each field: record the extracted value and its source location.
      Mark fields as null if they are not found in the source.
  normalize:
    description: Normalise and validate the extracted values against the target schema.
    needs:
      - extract
    instructions: |
      Normalise values to their target types (e.g., parse dates, trim strings, cast numbers).
      Validate each normalised value against the schema constraints.
      Flag fields that fail validation or have low extraction confidence.
contracts:
  outputs:
    - name: extracted_data
      type: object
      required: true
      description: Normalised data object conforming to the target extraction schema.
quality_gates:
  post_output:
    - name: schema-conformance-check
      check: "{{ output.extracted_data != null }}"
      message: Extracted data must be present and schema-conformant.
      severity: error
      on_fail: retry
---

# Extractor Agent

A three-step data extraction agent using chain-of-thought reasoning.
Suitable for structured data extraction from documents, emails, web pages, and unstructured text.

Update `identify_schema` with your target output schema and `extract` with your field-level extraction rules.
