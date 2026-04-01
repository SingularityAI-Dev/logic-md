---
spec_version: "1.0"
name: "branch-spec"
steps:
  check:
    description: "Check input"
    branches:
      - if: "{{ x > 0 }}"
        then: process
      - default: true
        then: fallback
    parallel_steps: [process, fallback]
  process:
    description: "Process input"
    needs: [check]
  fallback:
    description: "Fallback path"
---
