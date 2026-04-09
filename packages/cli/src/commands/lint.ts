import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from '@logic-md/core'
import { glob } from 'tinyglobby'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { Command } from 'commander'
import type { Colors } from '../output/color.js'
import type { LintIssue } from '../types.js'
import { formatWarning, formatSuccess } from '../output/formatter.js'
import { runAllRules } from '../rules/lint-rules.js'

/**
 * Apply --fix patches to a file, adding placeholder descriptions where missing.
 * Returns true if any fixes were written.
 */
function applyFix(filePath: string, issues: LintIssue[]): boolean {
  const missingDescIssues = issues.filter(
    (i) => i.rule === 'missing-description' || i.rule === 'missing-step-description',
  )

  if (missingDescIssues.length === 0) {
    return false
  }

  const content = readFileSync(filePath, 'utf8')

  // Extract YAML frontmatter between --- delimiters
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) {
    return false
  }

  const frontmatterRaw = fmMatch[1]
  const afterFrontmatter = content.slice(fmMatch[0].length)

  // Parse the frontmatter as YAML object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = parseYaml(frontmatterRaw) as Record<string, any>

  let changed = false

  // Fix top-level missing description
  if (missingDescIssues.some((i) => i.rule === 'missing-description')) {
    if (!doc['description']) {
      doc['description'] = 'TODO: Add description'
      changed = true
    }
  }

  // Fix per-step missing descriptions
  const stepIssues = missingDescIssues.filter((i) => i.rule === 'missing-step-description')
  if (stepIssues.length > 0 && doc['steps'] && typeof doc['steps'] === 'object') {
    for (const issue of stepIssues) {
      // Extract step name from message: 'Step "name" has no description'
      const match = issue.message.match(/^Step "(.+)" has no description$/)
      if (match) {
        const stepName = match[1]
        if (doc['steps'][stepName] && !doc['steps'][stepName]['description']) {
          doc['steps'][stepName]['description'] = 'TODO: Add description'
          changed = true
        }
      }
    }
  }

  if (!changed) {
    return false
  }

  const newFrontmatter = stringifyYaml(doc, { lineWidth: 0 }).trimEnd()
  const newContent = `---\n${newFrontmatter}\n---${afterFrontmatter}`
  writeFileSync(filePath, newContent, 'utf8')
  return true
}

/**
 * Lint a single file: parse → run rules → optionally fix → return issues.
 */
export function lintFile(filePath: string, fix: boolean): { issues: LintIssue[]; didFix: boolean } {
  const content = readFileSync(filePath, 'utf8')
  const parsed = parse(content)

  if (!parsed.ok) {
    const parseIssues: LintIssue[] = parsed.errors.map((err) => ({
      rule: 'parse-error',
      message: err.message,
      file: filePath,
      line: err.line,
      column: err.column,
      severity: 'warning' as const,
    }))
    return { issues: parseIssues, didFix: false }
  }

  let issues = runAllRules(parsed.data, filePath)
  let didFix = false

  if (fix) {
    didFix = applyFix(filePath, issues)
    if (didFix) {
      // Re-run lint after fix to report remaining issues
      const fixedContent = readFileSync(filePath, 'utf8')
      const reParsed = parse(fixedContent)
      if (reParsed.ok) {
        issues = runAllRules(reParsed.data, filePath)
      }
    }
  }

  return { issues, didFix }
}

export function registerLintCommand(program: Command, colors: Colors): void {
  program
    .command('lint')
    .description('Lint LOGIC.md files for advisory issues')
    .argument('<files...>', 'file paths or glob patterns')
    .option('--json', 'output machine-readable JSON')
    .option('--fix', 'auto-fix safe issues (adds placeholder descriptions)')
    .option('--no-color', 'disable colored output')
    .action(async (files: string[], opts: { json?: boolean; fix?: boolean }) => {
      const jsonMode = opts.json ?? false
      const fixMode = opts.fix ?? false

      // Expand globs
      const expanded = await glob(files, { absolute: true })
      if (expanded.length === 0) {
        process.stderr.write(`No files matched: ${files.join(', ')}\n`)
        process.exit(2)
      }

      const allIssues: LintIssue[] = []
      let totalIssues = 0

      for (const filePath of expanded) {
        const { issues, didFix } = lintFile(filePath, fixMode)
        allIssues.push(...issues)
        totalIssues += issues.length

        if (fixMode && didFix) {
          process.stderr.write(`${filePath}: added missing description(s)\n`)
        }

        if (!jsonMode) {
          if (issues.length === 0) {
            process.stdout.write(formatSuccess(filePath, colors) + '\n')
          } else {
            for (const issue of issues) {
              process.stderr.write(formatWarning(filePath, issue, colors) + '\n')
            }
          }
        }
      }

      if (jsonMode) {
        process.stdout.write(JSON.stringify(allIssues, null, 2) + '\n')
      }

      // Summary to stderr
      process.stderr.write(
        `${expanded.length} file(s) linted, ${totalIssues} issue(s) found\n`,
      )

      // LINT IS ADVISORY — always exit 0 for lint findings
      // Exit 2 is only for usage errors (no files matched), handled by program.error above
      process.exit(0)
    })
}
