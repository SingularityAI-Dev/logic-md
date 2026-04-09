import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerParseTool } from './parse.js'
import { registerValidateTool } from './validate.js'
import { registerLintTool } from './lint.js'
import { registerListTemplatesTool } from './list-templates.js'
import { registerInitTool } from './init.js'
import { registerCompileStepTool } from './compile-step.js'
import { registerCompileWorkflowTool } from './compile-workflow.js'

export function registerAllTools(server: McpServer): void {
  registerParseTool(server)
  registerValidateTool(server)
  registerLintTool(server)
  registerListTemplatesTool(server)
  registerInitTool(server)
  registerCompileStepTool(server)
  registerCompileWorkflowTool(server)
}
