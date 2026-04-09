import { readFile } from 'node:fs/promises'
import { parse, validate, compileWorkflow, estimateTokens } from '@logic-md/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { guardPath } from '../security/path-guard.js'

export function registerCompileWorkflowTool(server: McpServer): void {
  server.registerTool(
    'logic_md_compile_workflow',
    {
      description: 'Compile an entire LOGIC.md spec into a workflow execution plan with DAG ordering, quality gates, and fallback policy.',
      inputSchema: {
        content: z.string().optional().describe('LOGIC.md content to compile directly'),
        file_path: z.string().optional().describe('Path to a LOGIC.md file (must be within working directory)'),
        context: z.object({
          currentStep: z.string().optional(),
          previousOutputs: z.record(z.string(), z.unknown()).optional(),
          input: z.unknown().optional(),
          attemptNumber: z.number().optional(),
          branchReason: z.string().nullable().optional(),
          previousFailureReason: z.string().nullable().optional(),
          totalSteps: z.number().optional(),
          completedSteps: z.array(z.string()).optional(),
          dagLevels: z.array(z.array(z.string())).optional(),
        }).optional().describe('Workflow context for compilation'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ content, file_path, context }) => {
      let source: string

      if (content !== undefined) {
        source = content
      } else if (file_path !== undefined) {
        const guard = await guardPath(file_path)
        if (!guard.allowed) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: guard.reason ?? 'Path not allowed' }],
          }
        }
        try {
          source = await readFile(guard.resolved, 'utf8')
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Failed to read file: ${message}` }],
          }
        }
      } else {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Either content or file_path is required' }],
        }
      }

      const parseResult = parse(source)
      if (!parseResult.ok) {
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `Parse failed: ${parseResult.errors.map(e => e.message).join('; ')}`,
          }],
        }
      }

      const validateResult = validate(source)
      if (!validateResult.ok) {
        return {
          isError: true,
          content: [{
            type: 'text' as const,
            text: `Validation failed: ${validateResult.errors.map(e => e.message).join('; ')}`,
          }],
        }
      }

      const stepKeys = Object.keys(parseResult.data.steps ?? {})
      const workflowContext = {
        currentStep: context?.currentStep ?? stepKeys[0] ?? 'unknown',
        previousOutputs: context?.previousOutputs ?? {},
        input: context?.input ?? null,
        attemptNumber: context?.attemptNumber ?? 1,
        branchReason: context?.branchReason ?? null,
        previousFailureReason: context?.previousFailureReason ?? null,
        totalSteps: context?.totalSteps ?? stepKeys.length,
        completedSteps: context?.completedSteps ?? [],
        dagLevels: context?.dagLevels ?? [],
      }

      let compiled
      try {
        compiled = compileWorkflow(parseResult.data, workflowContext)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Compile failed: ${message}` }],
        }
      }

      const executionPlan = compiled.steps.map(step => ({
        stepName: step.metadata.stepName,
        dagLevel: step.metadata.dagLevel,
        systemPromptSegment: step.systemPromptSegment,
        outputSchema: step.outputSchema,
        qualityGates: step.qualityGates.length,
        tokenEstimate: estimateTokens(step.systemPromptSegment),
        tokenWarning: step.tokenWarning,
        metadata: step.metadata,
      }))

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            executionPlan,
            dagLevels: compiled.dagLevels,
            globalGates: compiled.globalQualityGates.length,
            fallbackPolicy: compiled.fallbackPolicy,
            metadata: compiled.metadata,
          }, null, 2),
        }],
      }
    }
  )
}
