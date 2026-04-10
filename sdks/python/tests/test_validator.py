"""Tests for the LOGIC.md validator."""

import pytest
from logic_md.validator import validate


def test_validate_minimal_spec():
    """Test validating a minimal valid spec."""
    spec = {
        "spec_version": "1.0",
        "name": "test-agent",
    }
    result = validate(spec)

    assert result["ok"] is True
    assert result["data"]["spec_version"] == "1.0"
    assert result["data"]["name"] == "test-agent"


def test_validate_missing_spec_version():
    """Test that missing spec_version fails validation."""
    spec = {
        "name": "test-agent",
    }
    result = validate(spec)

    assert result["ok"] is False
    assert len(result["errors"]) > 0
    assert any("spec_version" in e["message"] for e in result["errors"])


def test_validate_missing_name():
    """Test that missing name fails validation."""
    spec = {
        "spec_version": "1.0",
    }
    result = validate(spec)

    assert result["ok"] is False
    assert len(result["errors"]) > 0
    assert any("name" in e["message"] for e in result["errors"])


def test_validate_wrong_spec_version():
    """Test that wrong spec_version fails validation."""
    spec = {
        "spec_version": "2.0",
        "name": "test-agent",
    }
    result = validate(spec)

    assert result["ok"] is False
    assert len(result["errors"]) > 0


def test_validate_invalid_reasoning_strategy():
    """Test that invalid reasoning strategy fails."""
    spec = {
        "spec_version": "1.0",
        "name": "test-agent",
        "reasoning": {
            "strategy": "invalid-strategy",
        },
    }
    result = validate(spec)

    assert result["ok"] is False
    assert any("strategy" in e["message"] for e in result["errors"])


def test_validate_unknown_property():
    """Test that unknown top-level properties fail."""
    spec = {
        "spec_version": "1.0",
        "name": "test-agent",
        "unknown_property": "value",
    }
    result = validate(spec)

    assert result["ok"] is False


def test_validate_with_description():
    """Test validating spec with description."""
    spec = {
        "spec_version": "1.0",
        "name": "test-agent",
        "description": "A test agent",
    }
    result = validate(spec)

    assert result["ok"] is True
    assert result["data"]["description"] == "A test agent"


def test_validate_with_valid_reasoning():
    """Test validating spec with valid reasoning config."""
    spec = {
        "spec_version": "1.0",
        "name": "reasoner",
        "reasoning": {
            "strategy": "cot",
            "max_iterations": 5,
            "temperature": 0.7,
        },
    }
    result = validate(spec)

    assert result["ok"] is True


def test_validate_with_steps():
    """Test validating spec with steps."""
    spec = {
        "spec_version": "1.0",
        "name": "with-steps",
        "steps": {
            "step1": {
                "description": "First step",
            },
            "step2": {
                "description": "Second step",
                "needs": ["step1"],
            },
        },
    }
    result = validate(spec)

    assert result["ok"] is True


def test_validate_with_metadata():
    """Test validating spec with arbitrary metadata."""
    spec = {
        "spec_version": "1.0",
        "name": "with-metadata",
        "metadata": {
            "custom_field": "custom_value",
            "another": 42,
        },
    }
    result = validate(spec)

    assert result["ok"] is True


def test_validate_string_content():
    """Test validating by passing raw string content."""
    content = """---
spec_version: "1.0"
name: from-string
---

Body.
"""
    result = validate(content)

    assert result["ok"] is True
    assert result["data"]["name"] == "from-string"


def test_validate_string_content_invalid():
    """Test that invalid string content is caught."""
    content = """---
spec_version: "2.0"
name: invalid
---

Body.
"""
    result = validate(content)

    assert result["ok"] is False


def test_validate_empty_name():
    """Test that empty name fails validation."""
    spec = {
        "spec_version": "1.0",
        "name": "",
    }
    result = validate(spec)

    assert result["ok"] is False
