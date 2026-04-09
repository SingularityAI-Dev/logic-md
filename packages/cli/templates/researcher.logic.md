---
spec_version: "1.0"
name: researcher
description: Multi-source research agent that investigates topics, cross-references sources, and produces structured reports.
reasoning:
  strategy: react
  max_iterations: 8
steps:
  define_scope:
    description: Clarify the research question and define the investigation boundaries.
    instructions: |
      Identify the core research question and its sub-questions.
      Define the scope: what sources to consult, what time range is relevant, what is out of scope.
      List the key terms and concepts to investigate.
  investigate:
    description: Gather information from relevant sources on the defined topic.
    needs:
      - define_scope
    instructions: |
      Search for information relevant to each sub-question.
      Record source names, key claims, and supporting evidence.
      Flag conflicting claims and information gaps for cross-referencing.
  cross_reference:
    description: Validate and reconcile findings across multiple sources.
    needs:
      - investigate
    instructions: |
      Compare findings across sources and identify agreements and contradictions.
      Assess the reliability and authority of each source.
      Resolve conflicts by weighting evidence quality and source credibility.
  report:
    description: Compile validated findings into a structured research report.
    needs:
      - cross_reference
    instructions: |
      Organise findings by sub-question and present them with supporting evidence.
      Include source citations, confidence levels, and any unresolved questions.
      Provide a clear summary and conclusion.
contracts:
  outputs:
    - name: research_report
      type: object
      required: true
      description: Structured report containing findings, sources, and conclusions.
quality_gates:
  post_output:
    - name: source-coverage-check
      check: "{{ output.research_report != null }}"
      message: Research report must be present with source citations.
      severity: error
      on_fail: retry
---

# Researcher Agent

A four-step research agent using the ReAct (Reason + Act) strategy.
Suitable for investigative research, literature reviews, and fact-finding tasks.

Update `define_scope` instructions with your specific research domain and sources.
