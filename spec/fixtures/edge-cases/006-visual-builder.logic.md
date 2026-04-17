---
spec_version: "1.0"
name: visual-builder
reasoning:
  strategy: cot
visual:
  icon: "brain"
  category: "reasoning"
  color: "#6366F1"
  inspector:
    - key: reasoning.strategy
      label: "Reasoning Strategy"
      type: select
  ports:
    inputs:
      - name: query
        type: string
        required: true
    outputs:
      - name: result
        type: object
---

Exercises SPEC §10 (visual builder integration). Tests that `visual.icon`,
`visual.category`, `visual.color`, `visual.inspector[]`, and `visual.ports`
(with `inputs` and `outputs` arrays) parse into the expected shape for
visual node-based agent builders.
