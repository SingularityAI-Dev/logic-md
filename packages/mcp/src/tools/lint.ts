import { readFile } from 'node:fs/promises'
import { parse } from '@logic-md/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { guardPath } from '../security/path-guard.js'
import { runAllRules } from '../rules/lint-rules.js'

export function registerLintTool(server: McpServer): void {
  server.registerTool(
    'logic_md_lint',
    {
      description: 'Run lint rules against a LOGIC.md file or content string. Returns a list of issues with severity and a summary count.',
      inputSchema: {
        content: z.string().optional().describe('LOGIC.md content to lint directly'),
        file_path: z.string().optional().describe('Path to a LOGIC.md file (must be within working directory)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ content, file_path }) => {
      let source: string
      let fileLabel: string

      if (content !== undefined) {
        source = content
        fileLabel = '<inline>'
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
          fileLabel = file_path
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

      const issues = runAllRules(parseResult.data, fileLabel)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            issues,
            summary: {
              total: issues.length,
              warnings: issues.filter(i => i.severity === 'warning').length,
              infos: issues.filter(i => i.severity === 'info').length,
            },
          }, null, 2),
        }],
      }
    }
  )
}
