import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@logic-md/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { config } from '../config.js'

export function registerListTemplatesTool(server: McpServer): void {
  server.registerTool(
    'logic_md_list_templates',
    {
      description: 'List all available LOGIC.md templates with their name, description, and reasoning strategy.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      let files: string[]
      try {
        files = readdirSync(config.templatesDir).filter(f => f.endsWith('.logic.md'))
      } catch {
        // Directory not found or not accessible — return empty list, not an error
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ templates: [] }, null, 2) }],
        }
      }

      const templates = files.map(filename => {
        const name = filename.replace(/\.logic\.md$/, '')
        try {
          const content = readFileSync(join(config.templatesDir, filename), 'utf8')
          const result = parse(content)
          if (result.ok) {
            return {
              name,
              description: result.data.description ?? '',
              strategy: result.data.reasoning?.strategy ?? 'unknown',
            }
          }
        } catch {
          // If we can't read or parse a template, return minimal info
        }
        return {
          name,
          description: '',
          strategy: 'unknown',
        }
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ templates }, null, 2) }],
      }
    }
  )
}
