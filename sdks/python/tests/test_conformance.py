"""Conformance tests using canonical fixtures from spec/fixtures/."""

import json
from pathlib import Path

import pytest
from logic_md.parser import parse
from logic_md.validator import validate


def get_fixture_files():
    """Collect all .logic.md fixture files from spec/fixtures/."""
    test_dir = Path(__file__).parent
    fixtures_dir = test_dir.parent.parent.parent.parent / "spec" / "fixtures"

    if not fixtures_dir.exists():
        pytest.skip(f"Fixtures directory not found: {fixtures_dir}")

    # Glob for all .logic.md files
    fixture_files = sorted(fixtures_dir.glob("**/*.logic.md"))
    return fixture_files


@pytest.mark.parametrize(
    "fixture_file",
    get_fixture_files(),
    ids=lambda f: str(f.relative_to(Path(__file__).parent.parent.parent.parent / "spec" / "fixtures")),
)
def test_conformance(fixture_file):
    """
    Test each fixture file against its expected result.

    For each .logic.md file:
    1. Read the corresponding .expected.json
    2. Parse the LOGIC.md file
    3. Validate the parsed spec
    4. Compare results against expected
    """
    expected_file = fixture_file.with_suffix(".expected.json").name
    expected_path = fixture_file.parent / expected_file.replace(".logic.md", "").replace(".expected.json", ".expected.json")

    # Handle the naming correctly
    expected_path = fixture_file.with_name(fixture_file.stem + ".expected.json")

    if not expected_path.exists():
        pytest.fail(f"Expected file not found: {expected_path}")

    # Load fixture files
    logic_content = fixture_file.read_text(encoding="utf-8")
    expected_data = json.loads(expected_path.read_text(encoding="utf-8"))

    # Parse the LOGIC.md file
    parse_result = parse(logic_content)

    # Determine if this fixture is valid or invalid
    expected_valid = expected_data.get("valid", False)

    if expected_valid:
        # For valid fixtures, check that parsing succeeded
        assert parse_result["ok"], f"Parse failed for {fixture_file.name}: {parse_result.get('errors')}"

        # Validate the parsed spec
        validate_result = validate(parse_result["data"])
        assert validate_result["ok"], (
            f"Validation failed for {fixture_file.name}: {validate_result.get('errors')}"
        )

        # Check that parsed data matches expected
        expected_parsed = expected_data.get("parsed", {})
        for key, value in expected_parsed.items():
            assert parse_result["data"].get(key) == value, (
                f"Mismatch in {fixture_file.name}.{key}: "
                f"got {parse_result['data'].get(key)}, expected {value}"
            )
    else:
        # For invalid fixtures, validation should fail
        # First try to parse
        if parse_result["ok"]:
            # If parse succeeded, validation must fail
            validate_result = validate(parse_result["data"])
            assert not validate_result["ok"], (
                f"Validation should have failed for invalid fixture {fixture_file.name}"
            )
        # If parse failed, that's also acceptable for invalid fixtures

        # Check that we got errors
        expected_errors = expected_data.get("errors", [])
        if expected_errors:
            # Collect all errors (from parse or validate)
            actual_errors = parse_result.get("errors", [])
            if not actual_errors and parse_result["ok"]:
                validate_result = validate(parse_result["data"])
                actual_errors = validate_result.get("errors", [])

            assert len(actual_errors) > 0, (
                f"Expected errors for invalid fixture {fixture_file.name}"
            )
