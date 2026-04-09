import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { Command } from 'commander'
import type { Colors } from '../output/color.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '../templates')

const TEMPLATES = [
  'minimal', 'analyst', 'researcher', 'reviewer', 'planner',
  'classifier', 'generator', 'validator', 'summarizer',
  'orchestrator', 'debugger', 'extractor',
] as const

const STRATEGIES = ['cot', 'react', 'tot', 'got', 'plan-execute'] as const

function loadTemplate(name: string): string {
  const templatePath = join(TEMPLATES_DIR, `${name}.logic.md`)
  return readFileSync(templatePath, 'utf8')
}

function listTemplates(): string[] {
  return readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.logic.md'))
    .map((f) => f.replace('.logic.md', ''))
    .sort()
}

/**
 * Parse YAML frontmatter from a LOGIC.md file.
 * Returns { frontmatter, body } where body is everything after the closing ---.
 */
function parseFrontmatter(content: string): {
  doc: Record<string, unknown>
  body: string
} {
  const lines = content.split('\n')
  const start = lines.indexOf('---')
  const end = lines.indexOf('---', start + 1)
  if (start === -1 || end === -1) {
    return { doc: {}, body: content }
  }
  const yamlStr = lines.slice(start + 1, end).join('\n')
  const doc = (parseYaml(yamlStr) as Record<string, unknown>) ?? {}
  const body = lines.slice(end + 1).join('\n')
  return { doc, body }
}

/**
 * Reconstruct a LOGIC.md file from a parsed frontmatter doc and markdown body.
 * The first H1 heading in body is updated to match the agent name when possible.
 */
function reconstructFile(
  doc: Record<string, unknown>,
  body: string,
): string {
  const yamlStr = stringifyYaml(doc, { lineWidth: 0 })
  // Update the first H1 heading in the body to the agent name
  const agentName = typeof doc['name'] === 'string' ? doc['name'] : undefined
  let updatedBody = body
  if (agentName) {
    updatedBody = body.replace(/^# .+/m, `# ${agentName}`)
  }
  return `---\n${yamlStr}---\n${updatedBody}`
}

interface InitOptions {
  template?: string
  output?: string
  name?: string
  list?: boolean
  color?: boolean
}

export function registerInitCommand(program: Command, _colors: Colors): void {
  program
    .command('init')
    .description('Scaffold a new LOGIC.md file from a template or interactive wizard')
    .option('--template <name>', 'use named template non-interactively')
    .option('--output <file>', 'write to file instead of stdout')
    .option('--name <name>', 'agent name for generated file')
    .option('--list', 'list available templates')
    .option('--no-color', 'disable colored output')
    .action(async (opts: InitOptions) => {
      // --list mode
      if (opts.list) {
        const templates = listTemplates()
        process.stdout.write('Available templates:\n')
        for (const t of templates) {
          process.stdout.write(`  ${t}\n`)
        }
        return
      }

      // --template mode (non-interactive, INIT-02)
      if (opts.template) {
        const available = listTemplates()
        if (!available.includes(opts.template)) {
          process.stderr.write(`error: unknown template "${opts.template}"\n`)
          process.stderr.write(`Available templates: ${available.join(', ')}\n`)
          process.exit(2)
        }

        let content = loadTemplate(opts.template)

        if (opts.name) {
          const { doc, body } = parseFrontmatter(content)
          doc['name'] = opts.name
          content = reconstructFile(doc, body)
        }

        if (opts.output) {
          writeFileSync(opts.output, content, 'utf8')
          process.stderr.write(`Created ${opts.output}\n`)
        } else {
          process.stdout.write(content)
        }
        return
      }

      // TTY guard (INIT-03): non-interactive without --template
      if (process.stdin.isTTY !== true) {
        process.stderr.write('error: logic-md init requires an interactive terminal\n')
        process.stderr.write('hint: use --template <name> for non-interactive mode\n')
        process.stderr.write('hint: use --list to see available templates\n')
        process.exit(2)
      }

      // Interactive wizard mode (INIT-01)
      const rl = createInterface({ input: process.stdin, output: process.stdout })

      try {
        // 1. Agent name
        const name = (await rl.question('Agent name [my-agent]: ')).trim() || 'my-agent'

        // 2. Description
        const description =
          (await rl.question('Description [An AI agent]: ')).trim() || 'An AI agent'

        // 3. Template/archetype
        const templateList = listTemplates()
        process.stdout.write('Agent types:\n')
        for (let i = 0; i < templateList.length; i++) {
          process.stdout.write(`  ${i + 1}. ${templateList[i]}\n`)
        }
        const templateChoiceRaw =
          (await rl.question(`Agent type [1]: `)).trim() || '1'
        const templateIndex = parseInt(templateChoiceRaw, 10) - 1
        const chosenTemplate =
          templateIndex >= 0 && templateIndex < templateList.length
            ? templateList[templateIndex]
            : 'minimal'

        // 4. Reasoning strategy
        const strategyRaw =
          (await rl.question(`Reasoning strategy (${STRATEGIES.join('|')}) [cot]: `)).trim() ||
          'cot'
        const strategy = (STRATEGIES as readonly string[]).includes(strategyRaw)
          ? strategyRaw
          : (process.stderr.write(`warning: unknown strategy "${strategyRaw}", defaulting to "cot"\n`),
            'cot')

        // 5. Include contracts?
        const addContracts =
          (await rl.question('Include output contracts? [y/N]: ')).trim().toLowerCase() === 'y'

        // 6. Include quality gates?
        const addGates =
          (await rl.question('Include quality gates? [y/N]: ')).trim().toLowerCase() === 'y'

        // 7. Output path
        const outputPath =
          (await rl.question('Output file [./LOGIC.md]: ')).trim() || './LOGIC.md'

        rl.close()

        // Generate from wizard answers
        let content = loadTemplate(chosenTemplate)
        const { doc, body } = parseFrontmatter(content)

        doc['name'] = name
        doc['description'] = description

        // Set reasoning strategy
        if (doc['reasoning'] && typeof doc['reasoning'] === 'object') {
          ;(doc['reasoning'] as Record<string, unknown>)['strategy'] = strategy
        } else {
          doc['reasoning'] = { strategy }
        }

        if (!addContracts && 'contracts' in doc) {
          delete doc['contracts']
        }

        if (!addGates && 'quality_gates' in doc) {
          delete doc['quality_gates']
        }

        content = reconstructFile(doc, body)

        // Overwrite confirmation if file exists
        const { existsSync } = await import('node:fs')
        if (existsSync(outputPath)) {
          const overwriteRl = createInterface({ input: process.stdin, output: process.stdout })
          const confirm =
            (await overwriteRl.question(`Overwrite ${outputPath}? [y/N]: `))
              .trim()
              .toLowerCase()
          overwriteRl.close()
          if (confirm !== 'y') {
            process.stderr.write('Aborted.\n')
            return
          }
        }

        writeFileSync(outputPath, content, 'utf8')
        process.stderr.write(`Created ${outputPath}\n`)
      } catch (err) {
        rl.close()
        throw err
      }
    })
}
