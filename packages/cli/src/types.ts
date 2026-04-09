export interface LintIssue {
  rule: string
  message: string
  file: string
  line?: number
  column?: number
  severity: 'warning' | 'info'
}

export type { ValidationError } from '@logic-md/core'

export interface ContractCheck {
  from: string
  to: string
  status: 'pass' | 'fail' | 'skipped'
  details: string
}

export interface BranchEval {
  stepName: string
  branchLabel: string
  expression: string
  result: unknown
  error?: string
}

export interface StepTestResult {
  stepName: string
  dagLevel: number
  parallelGroup: string[]
  estimatedTokens: number
  tokenWarning?: string
  contractCompatibility: ContractCheck[]
  branches?: BranchEval[]
}

export interface TestResult {
  file: string
  valid: boolean
  stepCount: number
  dagLevels: string[][]
  steps: StepTestResult[]
  contractIssues: number
}
