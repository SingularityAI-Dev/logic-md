import { readFileSync } from 'node:fs'
import diff from 'microdiff'
import type { Command } from 'commander'
import { validate } from '@logic-md/core'
import type { LogicSpec, ValidationError } from '@logic-md/core'
import type { Colors } from '../output/color.js'
import { formatError } from '../output/formatter.js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangedItem {
  name: string
  details: string[]
}

interface DiffSection {
  label: string
  added: string[]
  removed: string[]
  changed: ChangedItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compares two arrays of named items (with a `name` property) using microdiff
 * for field-level change detection. Returns added, removed, and changed items.
 */
function diffNamedArrays(
  a: Array<{ name: string }>,
  b: Array<{ name: string }>,
): { added: string[]; removed: string[]; changed: ChangedItem[] } {
  const aMap = new Map(a.map((item) => [item.name, item]))
  const bMap = new Map(b.map((item) => [item.name, item]))

  const added: string[] = []
  const removed: string[] = []
  const changed: ChangedItem[] = []

  for (const name of bMap.keys()) {
    if (!aMap.has(name)) {
      added.push(name)
    }
  }

  for (const name of aMap.keys()) {
    if (!bMap.has(name)) {
      removed.push(name)
    }
  }

  for (const name of aMap.keys()) {
    const aItem = aMap.get(name)!
    const bItem = bMap.get(name)
    if (!bItem) continue
    const changes = diff(aItem, bItem)
    if (changes.length > 0) {
      const details = changes.map((c) => {
        const fieldPath = c.path.join('.')
        if (c.type === 'REMOVE') {
          return `${fieldPath}: ${JSON.stringify(c.oldValue)} -> (removed)`
        }
        if (c.type === 'CREATE') {
          return `${fieldPath}: (added) -> ${JSON.stringify(c.value)}`
        }
        return `${fieldPath}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.value)}`
      })
      changed.push({ name, details })
    }
  }

  return { added, removed, changed }
}

// ─── Section diffing ──────────────────────────────────────────────────────────

/**
 * Compare two LogicSpec objects section-by-section and return a list of
 * DiffSection objects for each section that has changes.
 */
function diffSpecs(a: LogicSpec, b: LogicSpec): DiffSection[] {
  const sections: DiffSection[] = []

  // a. Top-level metadata fields
  const metadataSection: DiffSection = { label: 'Metadata', added: [], removed: [], changed: [] }
  const metadataFields: Array<keyof LogicSpec> = ['name', 'description', 'spec_version']
  for (const field of metadataFields) {
    const aVal = a[field]
    const bVal = b[field]
    if (aVal !== bVal) {
      metadataSection.changed.push({
        name: String(field),
        details: [`${JSON.stringify(aVal)} -> ${JSON.stringify(bVal)}`],
      })
    }
  }
  if (metadataSection.changed.length > 0) sections.push(metadataSection)

  // b. Reasoning config
  const reasoningSection: DiffSection = { label: 'Reasoning', added: [], removed: [], changed: [] }
  const aReasoning = a.reasoning ?? {}
  const bReasoning = b.reasoning ?? {}
  const reasoningChanges = diff(aReasoning, bReasoning)
  const reasoningLabelMap: Record<string, string> = {
    strategy: 'Strategy',
    max_iterations: 'Max Iterations',
    temperature: 'Temperature',
    thinking_budget: 'Thinking Budget',
  }
  if (reasoningChanges.length > 0) {
    const details = reasoningChanges.map((c) => {
      const fieldKey = c.path[0] ? String(c.path[0]) : c.path.join('.')
      const label = reasoningLabelMap[fieldKey] ?? fieldKey
      if (c.type === 'REMOVE') {
        return `${label}: ${JSON.stringify(c.oldValue)} -> (removed)`
      }
      if (c.type === 'CREATE') {
        return `${label}: (added) -> ${JSON.stringify(c.value)}`
      }
      return `${label}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.value)}`
    })
    reasoningSection.changed.push({ name: 'reasoning', details })
  }
  if (reasoningSection.changed.length > 0) sections.push(reasoningSection)

  // c. Steps
  const stepsSection: DiffSection = { label: 'Steps', added: [], removed: [], changed: [] }
  const aStepNames = Object.keys(a.steps ?? {})
  const bStepNames = Object.keys(b.steps ?? {})
  const aStepsMap = a.steps ?? {}
  const bStepsMap = b.steps ?? {}

  for (const name of bStepNames) {
    if (!(name in aStepsMap)) stepsSection.added.push(name)
  }
  for (const name of aStepNames) {
    if (!(name in bStepsMap)) stepsSection.removed.push(name)
  }
  for (const name of aStepNames) {
    if (!(name in bStepsMap)) continue
    const changes = diff(aStepsMap[name], bStepsMap[name])
    if (changes.length > 0) {
      const stepLabelMap: Record<string, string> = {
        description: 'description',
        instructions: 'instructions',
        needs: 'needs',
        branches: 'branches',
        retry: 'retry',
        verification: 'verification',
        timeout: 'timeout',
        allowed_tools: 'allowed_tools',
        denied_tools: 'denied_tools',
        execution: 'execution',
        parallel_steps: 'parallel_steps',
        join: 'join',
        confidence: 'confidence',
      }
      const details = changes.map((c) => {
        const fieldKey = c.path[0] ? String(c.path[0]) : c.path.join('.')
        const label = stepLabelMap[fieldKey] ?? fieldKey
        if (c.type === 'REMOVE') {
          return `${label}: ${JSON.stringify(c.oldValue)} -> (removed)`
        }
        if (c.type === 'CREATE') {
          return `${label}: (added) -> ${JSON.stringify(c.value)}`
        }
        return `${label}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.value)}`
      })
      stepsSection.changed.push({ name, details })
    }
  }
  if (stepsSection.added.length > 0 || stepsSection.removed.length > 0 || stepsSection.changed.length > 0) {
    sections.push(stepsSection)
  }

  // d. Contract Inputs
  const inputsSection: DiffSection = { label: 'Contract Inputs', added: [], removed: [], changed: [] }
  const aInputs = a.contracts?.inputs ?? []
  const bInputs = b.contracts?.inputs ?? []
  const inputsDiff = diffNamedArrays(aInputs, bInputs)
  inputsSection.added = inputsDiff.added
  inputsSection.removed = inputsDiff.removed
  inputsSection.changed = inputsDiff.changed
  if (inputsSection.added.length > 0 || inputsSection.removed.length > 0 || inputsSection.changed.length > 0) {
    sections.push(inputsSection)
  }

  // e. Contract Outputs
  const outputsSection: DiffSection = { label: 'Contract Outputs', added: [], removed: [], changed: [] }
  const aOutputs = a.contracts?.outputs ?? []
  const bOutputs = b.contracts?.outputs ?? []
  const outputsDiff = diffNamedArrays(aOutputs, bOutputs)
  outputsSection.added = outputsDiff.added
  outputsSection.removed = outputsDiff.removed
  outputsSection.changed = outputsDiff.changed
  if (outputsSection.added.length > 0 || outputsSection.removed.length > 0 || outputsSection.changed.length > 0) {
    sections.push(outputsSection)
  }

  // f. Quality Gates — Pre-Output
  const preOutputSection: DiffSection = { label: 'Quality Gates (Pre-Output)', added: [], removed: [], changed: [] }
  const aPreOutput = a.quality_gates?.pre_output ?? []
  const bPreOutput = b.quality_gates?.pre_output ?? []
  const preOutputDiff = diffNamedArrays(aPreOutput, bPreOutput)
  preOutputSection.added = preOutputDiff.added
  preOutputSection.removed = preOutputDiff.removed
  preOutputSection.changed = preOutputDiff.changed
  if (preOutputSection.added.length > 0 || preOutputSection.removed.length > 0 || preOutputSection.changed.length > 0) {
    sections.push(preOutputSection)
  }

  // g. Quality Gates — Post-Output
  const postOutputSection: DiffSection = { label: 'Quality Gates (Post-Output)', added: [], removed: [], changed: [] }
  const aPostOutput = a.quality_gates?.post_output ?? []
  const bPostOutput = b.quality_gates?.post_output ?? []
  const postOutputDiff = diffNamedArrays(aPostOutput, bPostOutput)
  postOutputSection.added = postOutputDiff.added
  postOutputSection.removed = postOutputDiff.removed
  postOutputSection.changed = postOutputDiff.changed
  if (postOutputSection.added.length > 0 || postOutputSection.removed.length > 0 || postOutputSection.changed.length > 0) {
    sections.push(postOutputSection)
  }

  // h. Quality Gates — Invariants
  const invariantsSection: DiffSection = { label: 'Quality Gates (Invariants)', added: [], removed: [], changed: [] }
  const aInvariants = a.quality_gates?.invariants ?? []
  const bInvariants = b.quality_gates?.invariants ?? []
  const invariantsDiff = diffNamedArrays(aInvariants, bInvariants)
  invariantsSection.added = invariantsDiff.added
  invariantsSection.removed = invariantsDiff.removed
  invariantsSection.changed = invariantsDiff.changed
  if (invariantsSection.added.length > 0 || invariantsSection.removed.length > 0 || invariantsSection.changed.length > 0) {
    sections.push(invariantsSection)
  }

  // i. Decision Trees
  const decisionTreesSection: DiffSection = { label: 'Decision Trees', added: [], removed: [], changed: [] }
  const aTreeNames = Object.keys(a.decision_trees ?? {})
  const bTreeNames = Object.keys(b.decision_trees ?? {})
  const aTreesMap = a.decision_trees ?? {}
  const bTreesMap = b.decision_trees ?? {}

  for (const name of bTreeNames) {
    if (!(name in aTreesMap)) decisionTreesSection.added.push(name)
  }
  for (const name of aTreeNames) {
    if (!(name in bTreesMap)) decisionTreesSection.removed.push(name)
  }
  for (const name of aTreeNames) {
    if (!(name in bTreesMap)) continue
    const changes = diff(aTreesMap[name], bTreesMap[name])
    if (changes.length > 0) {
      const details = changes.map((c) => {
        const fieldKey = c.path.join('.')
        if (c.type === 'REMOVE') {
          return `${fieldKey}: ${JSON.stringify(c.oldValue)} -> (removed)`
        }
        if (c.type === 'CREATE') {
          return `${fieldKey}: (added) -> ${JSON.stringify(c.value)}`
        }
        return `${fieldKey}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.value)}`
      })
      decisionTreesSection.changed.push({ name, details })
    }
  }
  if (decisionTreesSection.added.length > 0 || decisionTreesSection.removed.length > 0 || decisionTreesSection.changed.length > 0) {
    sections.push(decisionTreesSection)
  }

  // j. Fallback
  const fallbackSection: DiffSection = { label: 'Fallback', added: [], removed: [], changed: [] }
  const aFallback = a.fallback ?? {}
  const bFallback = b.fallback ?? {}
  const fallbackChanges = diff(aFallback, bFallback)
  if (fallbackChanges.length > 0) {
    const details = fallbackChanges.map((c) => {
      const fieldKey = c.path.join('.')
      if (c.type === 'REMOVE') {
        return `${fieldKey}: ${JSON.stringify(c.oldValue)} -> (removed)`
      }
      if (c.type === 'CREATE') {
        return `${fieldKey}: (added) -> ${JSON.stringify(c.value)}`
      }
      return `${fieldKey}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.value)}`
    })
    fallbackSection.changed.push({ name: 'fallback', details })
  }
  if (fallbackSection.changed.length > 0) sections.push(fallbackSection)

  // k. Visual
  const visualSection: DiffSection = { label: 'Visual', added: [], removed: [], changed: [] }
  const aVisual = a.visual ?? {}
  const bVisual = b.visual ?? {}
  const visualChanges = diff(aVisual, bVisual)
  if (visualChanges.length > 0) {
    const details = visualChanges.map((c) => {
      const fieldKey = c.path.join('.')
      if (c.type === 'REMOVE') {
        return `${fieldKey}: ${JSON.stringify(c.oldValue)} -> (removed)`
      }
      if (c.type === 'CREATE') {
        return `${fieldKey}: (added) -> ${JSON.stringify(c.value)}`
      }
      return `${fieldKey}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.value)}`
    })
    visualSection.changed.push({ name: 'visual', details })
  }
  if (visualSection.changed.length > 0) sections.push(visualSection)

  return sections
}

// ─── Output formatting ────────────────────────────────────────────────────────

function formatSections(sections: DiffSection[], colors: Colors): string {
  const lines: string[] = []

  for (const section of sections) {
    const hasChanges =
      section.added.length > 0 ||
      section.removed.length > 0 ||
      section.changed.length > 0

    if (!hasChanges) continue

    const header = colors.bold ? colors.bold(section.label) : section.label
    lines.push(header)

    for (const name of section.added) {
      const prefix = colors.green ? colors.green('  +') : '  +'
      lines.push(`${prefix} added: ${name}`)
    }

    for (const name of section.removed) {
      const prefix = colors.red ? colors.red('  -') : '  -'
      lines.push(`${prefix} removed: ${name}`)
    }

    for (const item of section.changed) {
      const prefix = colors.yellow ? colors.yellow('  ~') : '  ~'
      lines.push(`${prefix} changed: ${item.name}`)
      for (const detail of item.details) {
        lines.push(`      ${detail}`)
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

// ─── Command registration ─────────────────────────────────────────────────────

export function registerDiffCommand(program: Command, colors: Colors): void {
  program
    .command('diff')
    .description('Compare two LOGIC.md files structurally')
    .argument('<file1>', 'first LOGIC.md file')
    .argument('<file2>', 'second LOGIC.md file')
    .option('--no-color', 'disable colored output')
    .action((file1: string, file2: string) => {
      // Read file1
      let content1: string
      try {
        content1 = readFileSync(file1, 'utf8')
      } catch {
        process.stderr.write(`error: cannot read file: ${file1}\n`)
        process.exit(2)
      }

      // Read file2
      let content2: string
      try {
        content2 = readFileSync(file2, 'utf8')
      } catch {
        process.stderr.write(`error: cannot read file: ${file2}\n`)
        process.exit(2)
      }

      // Validate file1
      const result1 = validate(content1)
      if (!result1.ok) {
        process.stderr.write(`Validation errors in ${file1}:\n`)
        for (const err of result1.errors) {
          process.stderr.write(
            formatError(file1, err as ValidationError, colors) + '\n',
          )
        }
        process.exit(1)
      }

      // Validate file2
      const result2 = validate(content2)
      if (!result2.ok) {
        process.stderr.write(`Validation errors in ${file2}:\n`)
        for (const err of result2.errors) {
          process.stderr.write(
            formatError(file2, err as ValidationError, colors) + '\n',
          )
        }
        process.exit(1)
      }

      const specA = result1.data
      const specB = result2.data

      // Perform structural diff
      const sections = diffSpecs(specA, specB)
      const hasDiffs = sections.some(
        (s) =>
          s.added.length > 0 || s.removed.length > 0 || s.changed.length > 0,
      )

      if (!hasDiffs) {
        // Exit 0: files are structurally identical
        return
      }

      // Exit 1: files have structural differences
      const output = formatSections(sections, colors)
      process.stdout.write(output)
      process.exitCode = 1
    })
}
