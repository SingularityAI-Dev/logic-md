"""Parser for LOGIC.md frontmatter and markdown body."""

from typing import Dict, List, Any, TypedDict
import yaml


class ParseResult(TypedDict, total=False):
    """Result of parsing a LOGIC.md file."""
    ok: bool
    data: Dict[str, Any]
    content: str
    errors: List[str]


def parse(content: str) -> ParseResult:
    """
    Parse a LOGIC.md file into YAML frontmatter and markdown body.

    Extracts YAML between '---' delimiters at the start of the file.
    Returns a ParseResult with:
    - ok: True if parsing succeeded
    - data: Parsed YAML frontmatter (if ok=True)
    - content: Markdown body after frontmatter (if ok=True)
    - errors: List of error messages (if ok=False)

    Args:
        content: Raw LOGIC.md file content

    Returns:
        ParseResult with parsing outcome
    """
    if not content or not content.strip():
        return {
            "ok": False,
            "errors": ["Content is empty"],
        }

    # Check if content starts with ---
    if not content.startswith("---"):
        return {
            "ok": False,
            "errors": ["Content does not start with '---' (missing frontmatter delimiter)"],
        }

    # Find the closing --- delimiter
    try:
        # Skip the opening ---
        rest = content[3:]
        # Find the closing ---
        closing_idx = rest.find("---")
        if closing_idx == -1:
            return {
                "ok": False,
                "errors": ["Missing closing '---' delimiter for frontmatter"],
            }

        # Extract frontmatter and body
        frontmatter_str = rest[:closing_idx]
        body = rest[closing_idx + 3:].lstrip("\n")

        # Parse YAML
        try:
            data = yaml.safe_load(frontmatter_str)
        except yaml.YAMLError as e:
            return {
                "ok": False,
                "errors": [f"YAML parse error: {str(e)}"],
            }

        # Handle case where frontmatter is empty or None
        if data is None:
            data = {}
        if not isinstance(data, dict):
            return {
                "ok": False,
                "errors": ["Frontmatter must be a YAML object/dictionary"],
            }

        return {
            "ok": True,
            "data": data,
            "content": body,
        }

    except Exception as e:
        return {
            "ok": False,
            "errors": [f"Unexpected error during parsing: {str(e)}"],
        }
