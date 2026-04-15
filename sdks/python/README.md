# logic-md

A Python SDK for parsing and validating **LOGIC.md** specifications — declarative reasoning configurations for AI agents.

**Status:** Alpha — parser and validator only.

## Installation

```bash
pip install logic-md
```

## Quick Start

```python
from logic_md import parse, validate

# Parse a LOGIC.md file
with open("my-agent.logic.md") as f:
    content = f.read()

result = parse(content)
if result.ok:
    print(f"Parsed spec: {result.data['name']}")
else:
    print(f"Parse errors: {result.errors}")

# Validate the parsed spec
val_result = validate(result.data)
if val_result.ok:
    print("Spec is valid!")
else:
    for error in val_result.errors:
        print(f"Validation error at {error['path']}: {error['message']}")
```

## API

### `parse(content: str) -> ParseResult`

Extracts YAML frontmatter from a LOGIC.md file and returns a `ParseResult`:

- `ok: bool` — True if parsing succeeded
- `data: dict` — Parsed YAML frontmatter (if ok=True)
- `content: str` — Markdown body after frontmatter
- `errors: list[str]` — Error messages (if ok=False)

**Example:**

```python
result = parse("---\nspec_version: '1.0'\nname: my-agent\n---\n# My Agent")
# result.ok = True
# result.data = {"spec_version": "1.0", "name": "my-agent"}
# result.content = "# My Agent"
```

### `validate(spec: dict) -> ValidationResult`

Validates a parsed spec against the LOGIC.md JSON Schema and returns a `ValidationResult`:

- `ok: bool` — True if spec is valid
- `data: dict` — The validated spec (if ok=True)
- `errors: list[dict]` — Validation errors with `path`, `keyword`, `message` (if ok=False)

**Example:**

```python
result = validate({"spec_version": "1.0", "name": "my-agent"})
# result.ok = True
# result.data = {"spec_version": "1.0", "name": "my-agent"}
```

### `LogicSpec`

A TypedDict type hint for the parsed/validated spec structure. Use for type hints:

```python
from logic_md import LogicSpec

def process_spec(spec: LogicSpec) -> None:
    print(spec["name"])
```

## Schema

The validator uses the canonical JSON Schema from the [logic-md spec repository](https://github.com/SingularityAI-Dev/logic-md/blob/main/spec/schema.json).

## Links

- **Repository:** https://github.com/SingularityAI-Dev/logic-md
- **Specification:** https://github.com/SingularityAI-Dev/logic-md/blob/main/docs/SPEC.md
- **Schema:** https://github.com/SingularityAI-Dev/logic-md/blob/main/spec/schema.json
