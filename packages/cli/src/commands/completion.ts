import type { Command } from "commander";
import type { Colors } from "../output/color.js";

// ─── Bash Completion Script ───────────────────────────────────────────────────

const BASH_COMPLETION = `# bash completion for logic-md
# Install: logic-md completion bash >> ~/.bash_completion
#   or:    logic-md completion bash > /usr/local/etc/bash_completion.d/logic-md

__logic_md_init_completion() {
  COMPREPLY=()
  _get_comp_words_by_ref cur prev words cword 2>/dev/null || {
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    words=("\${COMP_WORDS[@]}")
    cword=$COMP_CWORD
  }
}

_logic_md_completion() {
  _init_completion 2>/dev/null || __logic_md_init_completion

  local commands="validate lint fmt compile init test watch diff completion"

  # Determine the subcommand (second word)
  local subcommand=""
  if [[ \${#words[@]} -ge 2 ]]; then
    subcommand="\${words[1]}"
  fi

  # Positional argument completion based on previous word or subcommand
  case "\${prev}" in
    validate|lint|fmt|watch|compile|test|diff)
      COMPREPLY=($(compgen -f -- "\${cur}"))
      return 0
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "\${cur}"))
      return 0
      ;;
    --template)
      COMPREPLY=($(compgen -W "analyst classifier debugger extractor generator minimal orchestrator planner researcher reviewer summarizer validator" -- "\${cur}"))
      return 0
      ;;
    logic-md)
      COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
      return 0
      ;;
  esac

  # Flag completion when current word starts with -
  if [[ "\${cur}" == -* ]]; then
    case "\${subcommand}" in
      validate)
        COMPREPLY=($(compgen -W "--json --fix --no-color" -- "\${cur}"))
        ;;
      lint)
        COMPREPLY=($(compgen -W "--json --fix --no-color" -- "\${cur}"))
        ;;
      fmt)
        COMPREPLY=($(compgen -W "--check --no-color" -- "\${cur}"))
        ;;
      compile)
        COMPREPLY=($(compgen -W "--no-color" -- "\${cur}"))
        ;;
      init)
        COMPREPLY=($(compgen -W "--template --output --name --list --no-color" -- "\${cur}"))
        ;;
      test)
        COMPREPLY=($(compgen -W "--step --input --json --no-color" -- "\${cur}"))
        ;;
      watch)
        COMPREPLY=($(compgen -W "--fix --no-color" -- "\${cur}"))
        ;;
      diff)
        COMPREPLY=($(compgen -W "--no-color" -- "\${cur}"))
        ;;
      completion)
        COMPREPLY=()
        ;;
      *)
        COMPREPLY=($(compgen -W "--help --version" -- "\${cur}"))
        ;;
    esac
    return 0
  fi

  # Default: file completion for commands that take file arguments
  case "\${subcommand}" in
    validate|lint|fmt|watch|compile|test|diff)
      COMPREPLY=($(compgen -f -- "\${cur}"))
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "\${cur}"))
      ;;
    "")
      COMPREPLY=($(compgen -W "\${commands}" -- "\${cur}"))
      ;;
  esac

  return 0
}

complete -F _logic_md_completion logic-md
`;

// ─── Zsh Completion Script ────────────────────────────────────────────────────

const ZSH_COMPLETION = `#compdef logic-md
# zsh completion for logic-md
# Install: logic-md completion zsh > ~/.zsh/completions/_logic-md
#          (ensure ~/.zsh/completions is in your $fpath)
#   or:    logic-md completion zsh > "\${fpath[1]}/_logic-md"

_logic_md() {
  local state

  _arguments \\
    '1: :->command' \\
    '*: :->args'

  case $state in
    command)
      _values 'command' \\
        'validate[Validate LOGIC.md files]' \\
        'lint[Lint for advisory issues]' \\
        'fmt[Format to canonical style]' \\
        'compile[Compile to JSON]' \\
        'init[Scaffold new file]' \\
        'test[Simulate execution]' \\
        'watch[Watch for changes]' \\
        'diff[Compare two files]' \\
        'completion[Output shell completion script]'
      ;;
    args)
      case \${words[2]} in
        validate|lint)
          _arguments \\
            '--json[Output results as JSON]' \\
            '--fix[Auto-fix issues where possible]' \\
            '--no-color[Disable colored output]' \\
            '*:file:_files'
          ;;
        fmt)
          _arguments \\
            '--check[Check formatting without writing]' \\
            '--no-color[Disable colored output]' \\
            '*:file:_files'
          ;;
        compile)
          _arguments \\
            '--no-color[Disable colored output]' \\
            ':file:_files'
          ;;
        init)
          _arguments \\
            '--template:template:(analyst classifier debugger extractor generator minimal orchestrator planner researcher reviewer summarizer validator)' \\
            '--output[Output file path]' \\
            '--name[Workflow name]' \\
            '--list[List available templates]' \\
            '--no-color[Disable colored output]'
          ;;
        test)
          _arguments \\
            '--step[Run a specific step by name]' \\
            '--input[Input JSON file path]' \\
            '--json[Output results as JSON]' \\
            '--no-color[Disable colored output]' \\
            ':file:_files'
          ;;
        watch)
          _arguments \\
            '--fix[Auto-fix issues on change]' \\
            '--no-color[Disable colored output]' \\
            '*:dir:_files'
          ;;
        diff)
          _arguments \\
            '--no-color[Disable colored output]' \\
            ':file1:_files' \\
            ':file2:_files'
          ;;
        completion)
          _arguments \\
            ':shell:(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}

_logic_md "$@"
`;

// ─── Fish Completion Script ───────────────────────────────────────────────────

const FISH_COMPLETION = `# fish completion for logic-md
# Install: logic-md completion fish > ~/.config/fish/completions/logic-md.fish

# Disable file completion by default
complete -c logic-md -f

# Subcommand completions (only when no subcommand has been used yet)
complete -c logic-md -n '__fish_use_subcommand' -a 'validate' -d 'Validate LOGIC.md files'
complete -c logic-md -n '__fish_use_subcommand' -a 'lint' -d 'Lint for advisory issues'
complete -c logic-md -n '__fish_use_subcommand' -a 'fmt' -d 'Format to canonical style'
complete -c logic-md -n '__fish_use_subcommand' -a 'compile' -d 'Compile to JSON'
complete -c logic-md -n '__fish_use_subcommand' -a 'init' -d 'Scaffold new file'
complete -c logic-md -n '__fish_use_subcommand' -a 'test' -d 'Simulate execution'
complete -c logic-md -n '__fish_use_subcommand' -a 'watch' -d 'Watch for changes'
complete -c logic-md -n '__fish_use_subcommand' -a 'diff' -d 'Compare two files'
complete -c logic-md -n '__fish_use_subcommand' -a 'completion' -d 'Output shell completion script'

# validate flags
complete -c logic-md -n '__fish_seen_subcommand_from validate' -l json -d 'Output results as JSON'
complete -c logic-md -n '__fish_seen_subcommand_from validate' -l fix -d 'Auto-fix issues where possible'

# lint flags
complete -c logic-md -n '__fish_seen_subcommand_from lint' -l json -d 'Output results as JSON'
complete -c logic-md -n '__fish_seen_subcommand_from lint' -l fix -d 'Auto-fix issues where possible'

# fmt flags
complete -c logic-md -n '__fish_seen_subcommand_from fmt' -l check -d 'Check formatting without writing'

# compile flags
# (no extra flags beyond --no-color)

# init flags
complete -c logic-md -n '__fish_seen_subcommand_from init' -l template -r -a 'analyst classifier debugger extractor generator minimal orchestrator planner researcher reviewer summarizer validator' -d 'Template archetype'
complete -c logic-md -n '__fish_seen_subcommand_from init' -l output -d 'Output file path'
complete -c logic-md -n '__fish_seen_subcommand_from init' -l name -d 'Workflow name'
complete -c logic-md -n '__fish_seen_subcommand_from init' -l list -d 'List available templates'

# test flags
complete -c logic-md -n '__fish_seen_subcommand_from test' -l step -r -d 'Run a specific step by name'
complete -c logic-md -n '__fish_seen_subcommand_from test' -l input -r -d 'Input JSON file path'
complete -c logic-md -n '__fish_seen_subcommand_from test' -l json -d 'Output results as JSON'

# watch flags
complete -c logic-md -n '__fish_seen_subcommand_from watch' -l fix -d 'Auto-fix issues on change'

# completion argument
complete -c logic-md -n '__fish_seen_subcommand_from completion' -f -a 'bash zsh fish' -d 'Shell type'

# --no-color for all subcommands
for subcmd in validate lint fmt compile init test watch diff
  complete -c logic-md -n "__fish_seen_subcommand_from $subcmd" -l no-color -d 'Disable colored output'
end

# File completion for commands that accept .logic.md files
for subcmd in validate lint fmt compile test diff
  complete -c logic-md -n "__fish_seen_subcommand_from $subcmd" -F
end

# Directory/file completion for watch
complete -c logic-md -n '__fish_seen_subcommand_from watch' -F
`;

// ─── Command registration ─────────────────────────────────────────────────────

export function registerCompletionCommand(program: Command, _colors: Colors): void {
	program
		.command("completion")
		.description("Output shell completion script for bash, zsh, or fish")
		.argument("<shell>", "shell type: bash, zsh, or fish")
		.addHelpText(
			"after",
			`\nExamples:\n  $ logic-md completion bash >> ~/.bash_completion\n  $ logic-md completion zsh > ~/.zsh/completions/_logic-md\n  $ logic-md completion fish > ~/.config/fish/completions/logic-md.fish`,
		)
		.action((shell: string) => {
			const scripts: Record<string, string> = {
				bash: BASH_COMPLETION,
				zsh: ZSH_COMPLETION,
				fish: FISH_COMPLETION,
			};
			if (!(shell in scripts)) {
				process.stderr.write(
					`error: unsupported shell '${shell}'\nSupported shells: bash, zsh, fish\n`,
				);
				process.exit(2);
			}
			process.stdout.write(scripts[shell]);
		});
}
