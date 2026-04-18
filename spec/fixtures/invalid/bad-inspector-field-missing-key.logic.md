---
spec_version: "1.0"
name: bad-inspector-field-missing-key
description: Invalid — `InspectorField` missing required `key`
visual:
  inspector:
    - label: "Reasoning Strategy"
      type: select
---

# Invalid inspector field

This fixture should fail because each `InspectorField` requires `key`, `label`,
and `type`. Omitting `key` should trigger a schema `required` error.
