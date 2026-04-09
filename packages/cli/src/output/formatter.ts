import type { Colors } from './color.js'
import type { LintIssue } from '../types.js'

interface FormattableError {
  message: string
  path?: string
  line?: number
  column?: number
}

export function formatError(file: string, err: FormattableError, colors: Colors): string {
  const loc = `${err.line ?? 0}:${err.column ?? 0}`
  const label = colors.red('[ERROR]')
  return `${file}:${loc} ${label} ${err.message}`
}

export function formatWarning(file: string, issue: LintIssue, colors: Colors): string {
  const loc = `${issue.line ?? 0}:${issue.column ?? 0}`
  const label = colors.yellow('[WARN]')
  return `${file}:${loc} ${label} ${issue.message}`
}

export function formatSuccess(file: string, colors: Colors): string {
  return `${colors.green('✓')} ${file}`
}
