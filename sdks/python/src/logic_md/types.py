"""Type definitions for LOGIC.md specifications."""

from typing import Any, TypedDict, Optional, List, Dict


class Step(TypedDict, total=False):
    """A reasoning step in the specification."""
    description: str
    needs: List[str]
    instructions: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    confidence: Dict[str, Any]
    branches: List[Dict[str, Any]]
    retry: Dict[str, Any]
    verification: Dict[str, Any]
    timeout: str
    allowed_tools: List[str]
    denied_tools: List[str]
    execution: str
    parallel_steps: List[str]
    join: str
    join_timeout: str


class ContractField(TypedDict, total=False):
    """A field in a contract definition."""
    name: str
    type: str
    required: Any  # bool or List[str]
    description: str
    constraints: Dict[str, Any]
    properties: Dict[str, Dict[str, Any]]
    items: Dict[str, Any]


class Contracts(TypedDict, total=False):
    """Input/output contracts for the specification."""
    inputs: List[ContractField]
    outputs: List[ContractField]
    capabilities: Dict[str, Any]
    validation: Dict[str, Any]


class Gate(TypedDict, total=False):
    """A quality gate check."""
    name: str
    check: str
    message: str
    severity: str
    on_fail: str


class QualityGates(TypedDict, total=False):
    """Quality and verification rules."""
    pre_output: List[Gate]
    post_output: List[Gate]
    invariants: List[Dict[str, Any]]
    self_verification: Dict[str, Any]


class Reasoning(TypedDict, total=False):
    """Global reasoning strategy configuration."""
    strategy: str
    max_iterations: int
    temperature: float
    thinking_budget: int
    strategy_config: Dict[str, Any]


class Fallback(TypedDict, total=False):
    """Fallback and escalation configuration."""
    strategy: str
    escalation: List[Dict[str, Any]]
    degradation: List[Dict[str, Any]]


class GlobalConfig(TypedDict, total=False):
    """Global workflow constraints."""
    max_total_time: str
    max_total_cost: float
    fail_fast: bool
    max_parallelism: int


class LogicSpec(TypedDict, total=False):
    """Complete LOGIC.md specification."""
    spec_version: str
    name: str
    description: str
    imports: List[Dict[str, str]]
    reasoning: Reasoning
    steps: Dict[str, Step]
    contracts: Contracts
    quality_gates: QualityGates
    decision_trees: Dict[str, Dict[str, Any]]
    fallback: Fallback
    global_: GlobalConfig  # named global_ to avoid Python keyword
    nodes: Dict[str, Dict[str, Any]]
    edges: List[Dict[str, Any]]
    visual: Dict[str, Any]
    metadata: Dict[str, Any]
