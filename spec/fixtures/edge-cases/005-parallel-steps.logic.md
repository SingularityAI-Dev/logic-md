---
spec_version: "1.0"
name: parallel-steps
steps:
  gather:
    description: "Run three searches concurrently"
    execution: parallel
    parallel_steps:
      - search_web
      - search_internal
      - search_academic
    join: all
    join_timeout: "60s"
  synthesize:
    needs:
      - gather
    description: "Combine parallel findings"
    instructions: "Merge results from the three searches into a single report"
---

Exercises SPEC §4.3 (step execution modes). Tests that `execution: parallel`,
`parallel_steps`, `join`, and `join_timeout` parse correctly on a step, and
that a dependent step with `needs` can reference a parallel step by name.
