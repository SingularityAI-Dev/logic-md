---
spec_version: "1.0"
name: with-imports
# At the Parser conformance tier, implementations only need to prove these
# entries are parsed into an array of { ref, as } objects. Resolution of the
# referenced files (and merging their contents) is a Runtime-tier concern.
imports:
  - ref: "./shared/retry-policies.logic.md"
    as: policies
  - ref: "./shared/validation.logic.md"
    as: validation
reasoning:
  strategy: cot
---

Exercises SPEC §2.2 (imports). Tests that a sequence of `ref` + `as`
entries parses into an array. No file resolution required for Parser conformance.
