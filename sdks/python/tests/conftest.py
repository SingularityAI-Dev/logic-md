"""Shared pytest fixtures for logic-md tests."""

import json
import os
from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir():
    """Return path to the conformance fixtures directory."""
    # From tests/ -> sdks/python/ -> logic-md/ -> spec/fixtures/
    test_dir = Path(__file__).parent
    fixtures_path = test_dir.parent.parent.parent.parent / "spec" / "fixtures"
    return fixtures_path


@pytest.fixture
def load_fixture(fixtures_dir):
    """Fixture to load and pair .logic.md and .expected.json files."""
    def _load(name: str):
        """Load a fixture by name (without extension)."""
        logic_file = fixtures_dir / name
        expected_file = fixtures_dir / f"{name.replace('.logic.md', '')}.expected.json"

        if not logic_file.exists():
            raise FileNotFoundError(f"Fixture file not found: {logic_file}")
        if not expected_file.exists():
            raise FileNotFoundError(f"Expected file not found: {expected_file}")

        content = logic_file.read_text(encoding="utf-8")
        expected = json.loads(expected_file.read_text(encoding="utf-8"))

        return content, expected

    return _load
