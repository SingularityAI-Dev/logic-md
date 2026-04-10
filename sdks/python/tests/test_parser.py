"""Tests for the LOGIC.md parser."""

import pytest
from logic_md.parser import parse


def test_parse_minimal_spec():
    """Test parsing a minimal valid spec."""
    content = """---
spec_version: "1.0"
name: test-agent
---

This is the markdown body.
"""
    result = parse(content)

    assert result["ok"] is True
    assert result["data"]["spec_version"] == "1.0"
    assert result["data"]["name"] == "test-agent"
    assert "This is the markdown body." in result["content"]


def test_parse_with_description():
    """Test parsing spec with description."""
    content = """---
spec_version: "1.0"
name: test-agent
description: "A test agent specification"
---

Body content.
"""
    result = parse(content)

    assert result["ok"] is True
    assert result["data"]["description"] == "A test agent specification"


def test_parse_with_reasoning():
    """Test parsing spec with reasoning config."""
    content = """---
spec_version: "1.0"
name: reasoner
reasoning:
  strategy: cot
  max_iterations: 5
---

Reasoning spec.
"""
    result = parse(content)

    assert result["ok"] is True
    assert result["data"]["reasoning"]["strategy"] == "cot"
    assert result["data"]["reasoning"]["max_iterations"] == 5


def test_parse_empty_input():
    """Test parsing empty input."""
    result = parse("")

    assert result["ok"] is False
    assert len(result["errors"]) > 0


def test_parse_no_frontmatter():
    """Test parsing content without frontmatter."""
    content = "Just markdown, no frontmatter."
    result = parse(content)

    assert result["ok"] is False
    assert any("---" in str(e).lower() for e in result["errors"])


def test_parse_missing_closing_delimiter():
    """Test parsing with missing closing --- delimiter."""
    content = """---
spec_version: "1.0"
name: test

No closing delimiter
"""
    result = parse(content)

    assert result["ok"] is False
    assert any("closing" in str(e).lower() for e in result["errors"])


def test_parse_malformed_yaml():
    """Test parsing malformed YAML frontmatter."""
    content = """---
spec_version: "1.0"
name: [invalid: yaml: syntax
---

Body.
"""
    result = parse(content)

    assert result["ok"] is False
    assert any("yaml" in str(e).lower() for e in result["errors"])


def test_parse_empty_frontmatter():
    """Test parsing with empty frontmatter."""
    content = """---
---

Body content.
"""
    result = parse(content)

    assert result["ok"] is True
    assert result["data"] == {}
    assert "Body content." in result["content"]


def test_parse_frontmatter_not_dict():
    """Test parsing where frontmatter is not a dictionary."""
    content = """---
- item1
- item2
---

Body.
"""
    result = parse(content)

    assert result["ok"] is False
    assert any("object" in str(e).lower() or "dict" in str(e).lower() for e in result["errors"])


def test_parse_no_markdown_body():
    """Test parsing spec with no markdown body after frontmatter."""
    content = """---
spec_version: "1.0"
name: no-body
---
"""
    result = parse(content)

    assert result["ok"] is True
    assert result["data"]["name"] == "no-body"
    assert result["content"].strip() == ""


def test_parse_complex_steps():
    """Test parsing spec with complex steps."""
    content = """---
spec_version: "1.0"
name: complex
steps:
  step1:
    description: "First step"
    needs: []
  step2:
    description: "Second step"
    needs:
      - step1
---

Complex spec.
"""
    result = parse(content)

    assert result["ok"] is True
    assert "steps" in result["data"]
    assert "step1" in result["data"]["steps"]
    assert "step2" in result["data"]["steps"]
    assert result["data"]["steps"]["step2"]["needs"] == ["step1"]
