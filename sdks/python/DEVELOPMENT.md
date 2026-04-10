# Development Guide

## Setup

Install in development mode with test dependencies:

```bash
pip install -e ".[dev]"
```

## Testing

Run all tests:

```bash
pytest
```

With coverage report:

```bash
pytest --cov=logic_md --cov-report=html
```

### Test Structure

- **test_parser.py** — Unit tests for YAML frontmatter parsing (11 tests)
- **test_validator.py** — Unit tests for JSON Schema validation (13 tests)
- **test_conformance.py** — Parametrized conformance tests against all fixtures in spec/fixtures/ (18 fixtures)

Conformance fixtures are loaded from:
- `spec/fixtures/valid/` (7 valid specs)
- `spec/fixtures/invalid/` (7 invalid specs with expected errors)
- `spec/fixtures/edge-cases/` (4 edge case specs)

## Code Quality

Format code:

```bash
black src/logic_md tests
```

Lint:

```bash
ruff check src/logic_md tests
```

## Package Structure

```
sdks/python/
├── README.md                    # User-facing documentation
├── DEVELOPMENT.md              # This file
├── pyproject.toml              # PEP 621 project config
├── src/logic_md/
│   ├── __init__.py            # Public API
│   ├── parser.py              # YAML frontmatter extraction
│   ├── validator.py           # JSON Schema validation
│   ├── types.py               # TypedDict definitions
│   └── schema.json            # Canonical LOGIC.md JSON Schema
└── tests/
    ├── __init__.py
    ├── conftest.py            # Pytest fixtures
    ├── test_parser.py         # Parser unit tests
    ├── test_validator.py      # Validator unit tests
    └── test_conformance.py    # Fixture-based conformance tests
```

## API Overview

### `parse(content: str) -> ParseResult`

Extracts YAML frontmatter from a LOGIC.md file.

**Returns:**
- `ok: bool` — Success flag
- `data: dict` — Parsed YAML (if ok=True)
- `content: str` — Markdown body (if ok=True)
- `errors: list[str]` — Error messages (if ok=False)

### `validate(spec: dict | str) -> ValidationResult`

Validates a spec against the canonical schema. Accepts either a parsed dict or raw string.

**Returns:**
- `ok: bool` — Success flag
- `data: dict` — Validated spec (if ok=True)
- `errors: list[ValidationError]` — Errors with path, keyword, message (if ok=False)

## Publishing

When ready for PyPI:

```bash
# Build
python -m build

# Upload (requires PyPI credentials)
python -m twine upload dist/*
```

Set in pyproject.toml:
- Version in `[project] version`
- Status in `[project] classifiers`
