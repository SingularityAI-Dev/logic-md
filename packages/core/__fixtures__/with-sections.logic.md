---
spec_version: "1.0"
name: "full-sections"
description: "A spec with all optional sections"
reasoning:
  strategy: cot
  temperature: 0.7
steps:
  analyze:
    description: "Analyze"
contracts:
  inputs:
    - name: query
      type: string
quality_gates:
  pre_output:
    - name: length-check
      check: "{{ output.length > 0 }}"
decision_trees:
  route:
    description: "Route input"
    root: start
    nodes:
      start:
        condition: "{{ input.type }}"
        branches:
          - value: a
            next: term_a
    terminals:
      term_a:
        action: step_a
fallback:
  strategy: escalate
metadata:
  author: test
  version: 2
---
