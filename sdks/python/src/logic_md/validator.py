"""Validator for LOGIC.md specifications against JSON Schema."""

from typing import Dict, List, Any, TypedDict, Union
import json
import jsonschema
from jsonschema import Draft7Validator
import importlib.resources as resources

from .parser import parse, ParseResult


class ValidationError(TypedDict):
    """A validation error from jsonschema."""
    path: str
    keyword: str
    message: str


class ValidationResult(TypedDict, total=False):
    """Result of validating a LOGIC.md specification."""
    ok: bool
    data: Dict[str, Any]
    errors: List[ValidationError]


def _load_schema() -> Dict[str, Any]:
    """Load the JSON Schema from package data."""
    try:
        # Try using importlib.resources (Python 3.9+)
        if hasattr(resources, "files"):
            schema_file = resources.files("logic_md").joinpath("schema.json")
            schema_text = schema_file.read_text(encoding="utf-8")
        else:
            # Fallback for older Python versions
            import pkg_resources
            schema_text = pkg_resources.resource_string("logic_md", "schema.json").decode(
                "utf-8"
            )
        return json.loads(schema_text)
    except Exception as e:
        raise RuntimeError(f"Failed to load schema.json: {str(e)}")


# Cache the schema
_SCHEMA_CACHE: Dict[str, Any] = {}


def _get_schema() -> Dict[str, Any]:
    """Get cached schema, loading if necessary."""
    if not _SCHEMA_CACHE:
        _SCHEMA_CACHE.update(_load_schema())
    return _SCHEMA_CACHE


def validate(spec: Union[Dict[str, Any], str]) -> ValidationResult:
    """
    Validate a LOGIC.md specification against the JSON Schema.

    Accepts either:
    - A parsed spec dict: validates directly
    - A raw LOGIC.md string: parses then validates

    Returns a ValidationResult with:
    - ok: True if spec is valid
    - data: The validated spec (if ok=True)
    - errors: List of validation errors (if ok=False)

    Args:
        spec: Either a dict or a string to validate

    Returns:
        ValidationResult with validation outcome
    """
    # If string, parse first
    if isinstance(spec, str):
        parse_result = parse(spec)
        if not parse_result.get("ok"):
            return {
                "ok": False,
                "errors": [
                    {
                        "path": "",
                        "keyword": "parse",
                        "message": "; ".join(parse_result.get("errors", ["Unknown parse error"])),
                    }
                ],
            }
        spec = parse_result.get("data", {})

    # Load schema
    try:
        schema = _get_schema()
    except RuntimeError as e:
        return {
            "ok": False,
            "errors": [
                {
                    "path": "",
                    "keyword": "schema_load",
                    "message": str(e),
                }
            ],
        }

    # Validate against schema
    validator = Draft7Validator(schema)
    errors = []

    for error in validator.iter_errors(spec):
        # Construct path string
        path = ".".join(str(p) for p in error.absolute_path) if error.absolute_path else ""

        errors.append(
            {
                "path": path,
                "keyword": error.validator,
                "message": error.message,
            }
        )

    if errors:
        return {
            "ok": False,
            "errors": errors,
        }

    return {
        "ok": True,
        "data": spec,
    }
