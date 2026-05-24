# LOGIC.md Benchmark Results

Generated: 2026-05-07T09:58:06.657Z

## Summary Statistics

### code-review (meta/llama-3.1-70b-instruct) - control

- Runs: 10
- Aggregate Score: 98 ± 2 (range: 94-100)
- Structured Compliance: 100% ± 0%
- Describing vs Doing: 5% ± 7% (lower is better)
- Pipeline Completion: 100% ± 0%

### code-review (meta/llama-3.1-70b-instruct) - treatment

- Runs: 10
- Aggregate Score: 89 ± 30 (range: 0-100)
- Structured Compliance: 90% ± 30%
- Describing vs Doing: 14% ± 29% (lower is better)
- Pipeline Completion: 90% ± 30%

### research-synthesis (meta/llama-3.1-70b-instruct) - control

- Runs: 10
- Aggregate Score: 66 ± 44 (range: 0-100)
- Structured Compliance: 63% ± 42%
- Describing vs Doing: 32% ± 45% (lower is better)
- Pipeline Completion: 70% ± 46%

### research-synthesis (meta/llama-3.1-70b-instruct) - treatment

- Runs: 10
- Aggregate Score: 85 ± 29 (range: 0-100)
- Structured Compliance: 78% ± 28%
- Describing vs Doing: 12% ± 30% (lower is better)
- Pipeline Completion: 90% ± 30%

### security-audit (meta/llama-3.1-70b-instruct) - control

- Runs: 10
- Aggregate Score: 71 ± 36 (range: 0-89)
- Structured Compliance: 60% ± 30%
- Describing vs Doing: 20% ± 40% (lower is better)
- Pipeline Completion: 80% ± 40%

### security-audit (meta/llama-3.1-70b-instruct) - treatment

- Runs: 10
- Aggregate Score: 83 ± 17 (range: 50-100)
- Structured Compliance: 63% ± 32%
- Describing vs Doing: 0% ± 0% (lower is better)
- Pipeline Completion: 100% ± 0%

## Key Findings

### code-review:meta/llama-3.1-70b-instruct
- Control Aggregate Score: 98
- Treatment Aggregate Score: 89
- **Difference: -9 (-9.2%)**
- Control Describing vs Doing: 5%
- Treatment Describing vs Doing: 14%
- **Reduction: -9% points**

### research-synthesis:meta/llama-3.1-70b-instruct
- Control Aggregate Score: 66
- Treatment Aggregate Score: 85
- **Difference: +19 (28.8%)**
- Control Describing vs Doing: 32%
- Treatment Describing vs Doing: 12%
- **Reduction: 20% points**

### security-audit:meta/llama-3.1-70b-instruct
- Control Aggregate Score: 71
- Treatment Aggregate Score: 83
- **Difference: +12 (16.9%)**
- Control Describing vs Doing: 20%
- Treatment Describing vs Doing: 0%
- **Reduction: 20% points**

