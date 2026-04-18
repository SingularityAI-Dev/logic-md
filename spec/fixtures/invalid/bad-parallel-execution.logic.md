---
spec_version: "1.0"
name: bad-parallel-execution
description: Invalid — `execution` value not in enum
steps:
  gather:
    description: "Run three searches"
    execution: serial
    parallel_steps:
      - search_web
      - search_internal
    join: all
---

# Invalid execution value

This fixture should fail because `serial` is not a valid `execution` value.
The schema enum is `sequential | parallel | conditional`.
