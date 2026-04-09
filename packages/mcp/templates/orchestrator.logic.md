---
spec_version: "1.0"
name: orchestrator
description: Multi-agent orchestrator that plans work, dispatches parallel sub-tasks, and aggregates results.
reasoning:
  strategy: got
  max_iterations: 10
steps:
  plan:
    description: Determine how to distribute the work across parallel sub-agents.
    instructions: |
      Understand the overall goal and identify independently executable sub-tasks.
      Assign each sub-task to a dispatch step.
      Define the expected output from each sub-agent and how results will be merged.
  dispatch_a:
    description: Execute the first parallel sub-task.
    needs:
      - plan
    instructions: |
      Perform the first sub-task as defined in the plan.
      Produce a structured result that can be merged with other dispatch outputs.
      Report any errors or partial completions clearly.
  dispatch_b:
    description: Execute the second parallel sub-task.
    needs:
      - plan
    instructions: |
      Perform the second sub-task as defined in the plan.
      Produce a structured result that can be merged with other dispatch outputs.
      Report any errors or partial completions clearly.
  aggregate:
    description: Merge results from parallel dispatches into a unified outcome.
    needs:
      - dispatch_a
      - dispatch_b
    instructions: |
      Collect outputs from all completed dispatch steps.
      Resolve conflicts or overlaps between results.
      Produce a unified, coherent final result from all sub-task outputs.
contracts:
  outputs:
    - name: orchestration_result
      type: object
      required: true
      description: Unified result aggregated from all parallel sub-task outputs.
---

# Orchestrator Agent

A four-step multi-agent orchestrator using the Graph-of-Thought (GoT) strategy.
Runs `dispatch_a` and `dispatch_b` in parallel after planning, then aggregates results.

Add more `dispatch_*` steps and list them all in the `aggregate` step's `needs` to scale up parallelism.
Update the dispatch step instructions with your specific sub-task definitions.
