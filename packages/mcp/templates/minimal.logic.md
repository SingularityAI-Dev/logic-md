---
spec_version: "1.0"
name: minimal
description: The simplest valid LOGIC.md — a single step with no contracts or quality gates.
reasoning:
  strategy: cot
  max_iterations: 3
steps:
  execute:
    description: Perform the task.
    instructions: |
      Complete the assigned task using clear, step-by-step reasoning.
      Produce a concise and well-structured response.
---

# Minimal Agent

A single-step agent that performs a task using chain-of-thought reasoning.
Replace the step instructions with your own task-specific guidance.
