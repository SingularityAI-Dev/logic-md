# Design: carry parallel execution through compilation (issue #65)

## Problem

A step's parallel execution structure is silently dropped at the compile boundary. The authored schema accepts `execution` (`ExecutionMode`: sequential | parallel | conditional), `parallel_steps` (`string[]`, the fan-out set), `join` (`JoinMode`: all | any | majority, the fan-in strategy), and `join_timeout` (duration string). The compiler reads none of these, so `compileWorkflow(spec)` produces a flat topological step list with no record that the spec requested concurrency. A runtime consuming the compiled artifact cannot reconstruct the parallel plan and must reach back into the un-compiled spec, defeating the "compiled output is the execution plan" model.

This is the concurrency sibling of issue #64 (verification.on_fail dropped), fixed by carrying a singular `CompiledStep.verification`.

## Design

Mirror the source. The authored fields are per-step, so the compiled representation is per-step, exactly as #64 carried `CompiledStep.verification` to mirror `step.verification`.

### New type: `ExecutionPlan`

A first-class type that explicitly carries fan-out and fan-in, sibling to `CompiledVerification`.

```ts
export interface ExecutionPlan {
	/** Execution mode; defaults to "sequential" when unspecified (Section 4.3) */
	mode: ExecutionMode;
	/** Fan-out: the set of steps to run in parallel; empty when none authored */
	parallelSteps: string[];
	/** Fan-in: how parallel results are joined */
	join?: JoinMode;
	/** Duration string to wait on the join before timing out (for example "60s") */
	joinTimeout?: string;
}
```

### Placement

```ts
export interface CompiledStep {
	// ...existing fields, verification, etc.
	executionPlan: ExecutionPlan | null;
}
```

A step with no authored execution structure compiles to `executionPlan: null`, consistent with how #64 handled the no-verification case.

### Emit rule

Emit an `ExecutionPlan` when the authored step declares any of `execution`, `parallel_steps`, `join`, or `join_timeout`. Otherwise `null`. This faithfully mirrors "did the author say anything about execution structure," rather than fabricating a plan for every plain step.

When a plan is emitted:
- `mode` is `step.execution ?? "sequential"` (the SPEC default for an absent mode).
- `parallelSteps` is `step.parallel_steps ?? []` (always a concrete array, so consumers never branch on undefined for the fan-out set).
- `join` and `joinTimeout` are omitted when not authored (optional `?`, matching how `CompiledVerification.message` is omitted).

## Design choices (named for the PR)

1. **First-class `ExecutionPlan` over a metadata bag.** The issue offered a "quick" tier that bolts loose fields onto `CompiledStep.metadata`. We take the reviewer's steered "medium" shape: a named type that sits alongside `CompiledStep.verification` as a coherent sibling, so the compiled model stays a set of named concepts rather than a grab bag.

2. **`joinTimeout` carried as the authored duration string, not parsed to `joinTimeoutMs: number`.** The issue's quick sketch suggested `joinTimeoutMs`. We deviate, on purpose: `RetryPolicy` already carries durations verbatim as strings (`initialInterval: "1s"`), so a string keeps the compiled model internally consistent and faithful to the source, with no lossy or assumption-laden parsing at the compile boundary. A runtime parses the duration with whatever clock it uses.

3. **Per-step placement, not a workflow-level wrapper.** The authored fields are per-step, and the reviewer steered toward a sibling of the per-step `CompiledStep.verification`. A workflow-level wrapper around `CompiledStep[]` was the issue's heavier alternative; it is not needed to make the per-step intent survive compilation.

## Scope

In scope: carry the structure through `compileStep` so it appears on `CompiledStep.executionPlan`. Out of scope: making the executor honor parallelism (the executor walks DAG order flat today and consumes none of these fields) and updating the LangGraph adapter. Those are downstream consumers of the now-available shape and belong to separate work.

## Testing

Parametrised at canary strength, proving completeness not mere presence:
- each `ExecutionMode` (sequential, parallel, conditional) survives on `executionPlan.mode`
- each `JoinMode` (all, any, majority) survives on `executionPlan.join`
- more than one `parallel_steps` count survives intact (order and membership)
- `join_timeout` present is carried verbatim; absent is omitted
- a step with no execution structure compiles to `executionPlan: null`
