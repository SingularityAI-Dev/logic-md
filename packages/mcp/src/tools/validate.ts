import { readFile } from 'node:fs/promises'
import { validate } from '@logic-md/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { guardPath } from '../security/path-guard.js'

export function registerValidateTool(server: McpServer): void {
  server.registerTool(
    'logic_md_validate',
    {
      description: 'Validate a LOGIC.md file or content string against the JSON Schema. Returns valid: true on success, or validation errors on failure.',
      inputSchema: {
        content: z.string().optional().describe('LOGIC.md content to validate directly'),
        file_path: z.string().optional().describe('Path to a LOGIC.md file (must be within working directory)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ content, file_path }) => {
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

      const result = validate(source)
      if (result.ok) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ valid: true }, null, 2) }],
        }
      } else {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, errors: result.errors }, null, 2) }],
        }
      }
    }
  )
}
