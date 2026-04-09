---
spec_version: "1.0"
name: classifier
description: Input classification agent that extracts features, assigns a category, and validates the classification with a confidence score.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  extract_features:
    description: Identify the key characteristics of the input relevant to classification.
    instructions: |
      Examine the input and extract distinguishing features.
      List the attributes, patterns, and signals that will inform the classification.
      Note any ambiguous or conflicting signals.
  classify:
    description: Assign the input to the most appropriate category.
    needs:
      - extract_features
    instructions: |
      Apply the classification criteria to the extracted features.
      Select the most likely category and record the reasoning.
      Assign a confidence score between 0.0 and 1.0.
      If confidence is below 0.6, consider the top two candidates.
  validate_classification:
    description: Verify the classification is consistent and well-supported.
    needs:
      - classify
    instructions: |
      Check the classification against the extracted features for consistency.
      Confirm the confidence score reflects the strength of evidence.
      If the classification is uncertain, flag it for human review.
contracts:
  outputs:
    - name: classification
      type: object
      required: true
      description: Classification result containing the assigned category and a confidence score between 0.0 and 1.0.
quality_gates:
  post_output:
    - name: confidence-threshold
      check: "{{ output.classification != null }}"
      message: Classification must include a category and confidence score.
      severity: error
      on_fail: retry
---

# Classifier Agent

A three-step classification agent using chain-of-thought reasoning.
Suitable for intent classification, content categorisation, and triage tasks.

Update `extract_features` with the relevant features for your classification domain.
Add your category labels to the `classify` step instructions.
