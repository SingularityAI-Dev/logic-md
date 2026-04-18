---
spec_version: "1.0"
name: bad-import-shape
description: Invalid — import entry missing required `ref`
imports:
  - as: policies
---

# Invalid import shape

This fixture should fail because each `Import` entry requires both `ref` and
`as` per the schema. Omitting `ref` should trigger a schema `required` error.
