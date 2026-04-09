import type { LogicSpec } from '@logic-md/core'
import type { LintIssue } from '../types.js'

/**
 * Rule 1: Check for missing descriptions on the top-level spec and individual steps.
 * Missing descriptions are advisory — they help documentation quality but don't
 * affect execution.
 */
export function checkMissingDescriptions(spec: LogicSpec, file: string): LintIssue[] {
  const issues: LintIssue[] = []

  if (!spec.description) {
    issues.push({
      rule: 'missing-description',
      message: 'Top-level description is missing',
      file,
      severity: 'warning',
    })
  }

  if (spec.steps) {
    for (const [name, step] of Object.entries(spec.steps)) {
      if (!step.description) {
        issues.push({
          rule: 'missing-step-description',
          message: `Step "${name}" has no description`,
          file,
          severity: 'warning',
        })
      }
    }
  }

  return issues
}

/**
 * Rule 2: Check for steps that are unreachable (not present in the DAG topological order).
 * Steps missing from the resolved order are isolated and will never execute.
 */
export function checkUnreachableSteps(spec: LogicSpec, file: string): LintIssue[] {
  const issues: LintIssue[] = []

  if (!spec.steps || Object.keys(spec.steps).length < 2) {
    return []
  }

  // Collect all step names that appear in any other step's `needs` array
  const referenced = new Set<string>()
  for (const step of Object.values(spec.steps)) {
    if (step.needs) {
      for (const dep of step.needs) {
        referenced.add(dep)
      }
    }
  }

  for (const name of Object.keys(spec.steps)) {
    if (!referenced.has(name)) {
      // Not depended on by anyone — check if it depends on others itself
      const step = spec.steps[name]
      const hasOutgoing = step.needs && step.needs.length > 0
      if (!hasOutgoing) {
        issues.push({
          rule: 'unreachable-step',
          message: `Step "${name}" is not reachable from any other step`,
          file,
          severity: 'warning',
        })
      }
    }
  }

  return issues
}

/**
 * Rule 3: Check for unused imports — imports whose namespace is never referenced
 * in any step's `needs` array.
 */
export function checkUnusedImports(spec: LogicSpec, file: string): LintIssue[] {
  const issues: LintIssue[] = []

  if (!spec.imports || spec.imports.length === 0) {
    return []
  }

  // Collect all needs references across all steps
  const allNeeds: string[] = []
  if (spec.steps) {
    for (const step of Object.values(spec.steps)) {
      if (step.needs) {
        allNeeds.push(...step.needs)
      }
    }
  }

  for (const imp of spec.imports) {
    const namespace = imp.as
    // Check if any needs entry uses this namespace as prefix: "namespace.stepName"
    const isReferenced = allNeeds.some((need) => need.startsWith(`${namespace}.`))
    if (!isReferenced) {
      issues.push({
        rule: 'unused-import',
        message: `Import "${imp.as}" (from "${imp.ref}") is never referenced`,
        file,
        severity: 'info',
      })
    }
  }

  return issues
}

/**
 * Run all lint rules against a parsed spec and return the combined results.
 */
export function runAllRules(spec: LogicSpec, file: string): LintIssue[] {
  return [
    ...checkMissingDescriptions(spec, file),
    ...checkUnreachableSteps(spec, file),
    ...checkUnusedImports(spec, file),
  ]
}
