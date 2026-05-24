# Changelog

All notable changes to the LOGIC.md VSCode extension will be documented in this file.

## [0.1.4] - 2026-05-15

### Fixed
- Align `@types/node` with the VSCode extension host runtime (#44).

### Changed
- chore(deps-dev): bump `@types/vscode` (#40).
- chore(deps-dev): bump TypeScript 5.9.3 → 6.0.3 (#33).
- chore(deps-dev): bump esbuild 0.25.12 → 0.28.0 (#34) and rebaseline to `^0.25.0` (#32); dependabot ignores `@types/node` majors going forward (#32).

## [0.1.0] - 2026-04-10

### Added

#### Syntax Highlighting
- Complete TextMate grammar for LOGIC.md files (`.logic.md` extension)
- YAML frontmatter highlighting with `---` delimiters
- LOGIC.md-specific keyword recognition and color coding:
  - Core spec keywords: `spec_version`, `name`, `description`, `reasoning`, etc.
  - Step properties: `needs`, `instructions`, `branches`, `verification`, `retry`, `timeout`, `allowed_tools`, `denied_tools`, `output_schema`, `input_schema`
  - Contract properties: `input_schema`, `output_schema`, `invariants`, `preconditions`, `postconditions`, `error_handling`, `sla`, `severity`
  - Decision tree properties: `condition`, `then_step`, `else_step`, `default_step`, `decision_id`
  - Quality gate properties: `metric`, `threshold`, `on_fail`, `severity`, `message`
  - Retry configuration: `max_attempts`, `delay`, `backoff`, `backoff_factor`
  - Fallback configuration: `step`, `steps`, `decision_tree`, `message`, `action`

#### Expression Syntax Support
- Full support for `{{ ... }}` expression syntax
- Expression operators: logical (`and`, `or`, `not`), comparison (`==`, `!=`, `<=`, `>=`, etc.), arithmetic (`+`, `-`, `*`, `/`)
- Expression keywords: `if`, `then`, `else`, `switch`, `case`, `for`, `while`
- Built-in functions: `len`, `type`, `keys`, `values`, `has`, `get`, `set`, `push`, `pop`, `slice`, `join`, `split`, `contains`, `startsWith`, `endsWith`, `toLowerCase`, `toUpperCase`, `trim`, `replace`, `match`, `round`, `floor`, `ceil`, `abs`, `min`, `max`, `sum`, `avg`, `count`, `distinct`, `sort`, `reverse`, `filter`, `map`, `reduce`, `group`, `unique`, `flatten`, `compact`
- String, number, boolean, and null literal highlighting
- Variable reference highlighting

#### Reasoning Strategies
- Color coding for reasoning strategy values: `cot`, `react`, `tot`, `got`, `plan-execute`, `custom`

#### Failure Handling
- Highlighting for `on_fail` values: `retry`, `escalate`, `skip`, `abort`, `revise`

#### Severity Levels
- Highlighting for severity values: `error`, `warning`, `info`

#### Markdown Body Support
- Standard Markdown syntax highlighting after frontmatter:
  - Headings (`#`, `##`, `###`, etc.)
  - Bold (`**text**`, `__text__`)
  - Italic (`*text*`, `_text_`)
  - Inline code (`` `code` ``)
  - Code blocks (triple backticks)
  - Links (`[text](url)`)
  - Lists (bullet points and numbered)
- Expression highlighting within Markdown

#### Code Intelligence
- Smart indentation rules for LOGIC.md structures
- Auto-closing pairs for brackets, braces, quotes, and expression delimiters
- Comment toggling support (`#` for YAML comments)
- Bracket and brace matching
- Code folding by indentation for YAML and Markdown sections

#### Code Snippets
- `logic-init`: Full LOGIC.md specification template
- `logic-step`: New step definition
- `logic-contracts`: Contract block
- `logic-gates`: Quality gates configuration
- `logic-branch`: Branch condition
- `logic-fallback`: Fallback configuration with decision tree
- `logic-retry`: Retry configuration
- `logic-decision-tree`: Decision tree structure
- `logic-import`: Import statements
- `logic-expr`: Expression placeholder

#### Language Configuration
- Comment character set to `#` for YAML sections
- Auto-closing pair configuration
- Surrounding pair configuration for editing
- Indentation rules for nested structures
- Word pattern configuration for proper word boundary detection

### Documentation
- Comprehensive README.md with feature descriptions and usage examples
- Installation instructions from marketplace, VSIX, or source
- File structure documentation
- Example LOGIC.md file
- Troubleshooting guide

### Files
- `package.json`: VSCode extension manifest
- `syntaxes/logic-md.tmLanguage.json`: TextMate grammar
- `snippets/logic-md.json`: Code snippets
- `language-configuration.json`: Language configuration
- `README.md`: User documentation
- `CHANGELOG.md`: Version history
- `.vscodeignore`: Files to exclude from package
- `.gitignore`: Git ignore patterns

## Future Enhancements

### Planned for 0.2.0
- Schema validation against LOGIC.md specification
- Real-time linting and error detection
- Code actions and quick fixes
- Document formatting
- Hover documentation for LOGIC.md keywords
- Go to definition for step references
- Symbol outline for quick navigation

### Planned for 0.3.0
- WebAssembly-based parser for faster validation
- Integration with `@logic-md/core` validator
- Debugging support with step-by-step execution
- Test runner integration
- Visual workflow diagram preview

### Planned for 1.0.0
- Completion provider for step references
- Inline diagnostics with severity levels
- Code lens for test coverage
- Git blame integration
- Performance profiling tools
