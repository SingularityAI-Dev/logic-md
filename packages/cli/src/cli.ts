import { Command } from 'commander'
import { createRequire } from 'node:module'
import { detectColorSupport, makeColors } from './output/color.js'
import { registerValidateCommand } from './commands/validate.js'
import { registerLintCommand } from './commands/lint.js'
import { registerFmtCommand } from './commands/fmt.js'
import { registerCompileCommand } from './commands/compile.js'
import { registerInitCommand } from './commands/init.js'
import { registerTestCommand } from './commands/test.js'
import { registerWatchCommand } from './commands/watch.js'
import { registerDiffCommand } from './commands/diff.js'
import { registerCompletionCommand } from './commands/completion.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }
const VERSION = pkg.version

const colorEnabled = detectColorSupport()
const colors = makeColors(colorEnabled)

export const program = new Command()

program
  .name('logic-md')
  .description('LOGIC.md authoring CLI')
  .version(VERSION)
  .configureOutput({
    writeErr: (str) => process.stderr.write(str),
    writeOut: (str) => process.stdout.write(str),
  })
  .showHelpAfterError(true)
  .exitOverride((err) => {
    // Map Commander's usage errors (code 'commander.unknownCommand', etc.) to exit 2
    const usageErrorCodes = [
      'commander.unknownCommand',
      'commander.unknownOption',
      'commander.invalidArgument',
      'commander.missingArgument',
      'commander.missingMandatoryOptionValue',
      'commander.optionMissingArgument',
      'commander.excessArguments',
    ]
    if (usageErrorCodes.includes(err.code)) {
      // Commander already wrote the error message via configureOutput.writeErr
      process.exit(2)
    }
    // For --version and --help, exit cleanly with 0
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.help' ||
      err.code === 'commander.version'
    ) {
      process.exit(0)
    }
    // For program.error() calls from command handlers, use the supplied exitCode (e.g., exitCode: 2)
    if (err.code === 'commander.error' && typeof err.exitCode === 'number') {
      process.exit(err.exitCode)
    }
    process.exit(1)
  })

registerValidateCommand(program, colors)
registerLintCommand(program, colors)
registerFmtCommand(program, colors)
registerCompileCommand(program, colors)
registerInitCommand(program, colors)
registerTestCommand(program, colors)
registerWatchCommand(program, colors)
registerDiffCommand(program, colors)
registerCompletionCommand(program, colors)

// Show help and exit 0 when called with no arguments
if (process.argv.length <= 2) {
  program.help()
}

program.parseAsync(process.argv)
