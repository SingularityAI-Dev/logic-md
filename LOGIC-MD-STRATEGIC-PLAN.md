# LOGIC.md Strategic Improvement Plan

> Generated 2026-04-10 · Based on honest external critique + competitive analysis + protocol research

---

## Executive Summary

A Claude chat gave an unvarnished assessment of LOGIC.md. The good news: the README doesn't actually claim "first of its kind" or "zero prior art" — those were claims from other conversations, not the shipped artifacts. The README is already more honest than the critique assumed. But there are real gaps to close, real competitors to acknowledge, and real improvements that would make this project taken seriously by the skeptical senior engineer reading it over coffee.

**Strategy**: Ship clean, design protocol-shaped. Don't claim protocol status until external adoption validates it. Do the work now to make the spec separable, versioned, and language-agnostic enough that protocol evolution is a natural next step rather than a retrofit.

---

## Part 1: Honest Positioning Fixes

### 1.1 README Changes

**What's already good:**
- The describing-vs-doing case study is concrete and real
- "When to use / when not to use" section exists
- DSPy comparison is fair
- No "first of its kind" or "zero prior art" claims

**What needs fixing:**

| Issue | Current | Fix |
|-------|---------|-----|
| Missing BAML comparison | Only compares to DSPy | Add BAML as the closest analog — it's file-based, declarative, contracts-first. Explain the distinction: BAML focuses on output schema validation and structured extraction across 6+ languages; LOGIC.md focuses on reasoning flow, step DAGs, and multi-agent contracts. They're complementary, not competitors. |
| "production-validated" is oversold | "Currently powering the execution layer of Modular9" | Reframe: "Developed alongside and validated through Modular9, a visual node-based agent builder by the same author." Remove "production-validated" from Status section. One integration into your own project is a proof of concept, not production validation in the enterprise sense. |
| "solved a fundamental agent failure mode" is too strong | Line 14, line 88 | Soften to: "addressed a common agent failure mode" or "solved a recurring agent pipeline problem." The failure mode is real. The fix is real. But calling it "fundamental" implies nobody else has solved it, which isn't true. |
| "None of them give you a way to declare how your agent thinks" | Line 32 | This is the most overclaimed sentence. DSPy signatures, BAML files, CrewAI YAML, and Pydantic AI all gesture at this. Rewrite: "None of them give you a portable, framework-agnostic file format for reasoning contracts." That's the actual unique claim and it's defensible. |
| Missing Instructor/Outlines acknowledgment | Comparison table only | Add a footnote or brief mention: Instructor and Outlines handle structured output validation at the generation layer. LOGIC.md operates at the reasoning architecture layer — it defines step ordering, dependencies, quality gates, and multi-agent contracts. Different level of abstraction. |
| "This could not be solved with better system prompts" | Line 104 | Soften: "This was not practically solvable with ad-hoc prompt engineering at scale." The underlying techniques (execution mandates, contract injection) ARE prompt engineering — LOGIC.md just provides a declarative, repeatable way to apply them. Own that distinction. |
| Comparison table is slightly misleading | Line 241-254 | Add BAML to the table. Add Instructor. Make the "What it handles" column more nuanced — e.g., DSPy does handle declarative reasoning (just Python-bound). |

### 1.2 Case Study Reframe

The describing-vs-doing case study is the strongest thing in the project. Keep it. But add one paragraph at the end acknowledging the technique:

> The underlying techniques — execution mandates, output contract injection, structured input framing — are established patterns in prompt engineering. What LOGIC.md provides is a declarative, portable way to apply them systematically across any agent pipeline, so the fix travels with the spec rather than being buried in framework-specific code.

This pre-empts the "you didn't invent the fix, you packaged it" critique by owning it upfront.

### 1.3 New Section: "How this differs from BAML"

Add after the DSPy comparison:

```markdown
## How this differs from BAML

BAML (Boundary AI Markup Language) is the closest project in spirit — it's file-based, 
declarative, and contracts-first. The distinction is in scope and abstraction level.

**BAML** defines individual LLM function signatures: input types, output schemas, retry 
policies, and test cases. It generates type-safe client code in 6+ languages. The focus 
is on getting structured, validated outputs from individual LLM calls.

**LOGIC.md** defines reasoning architecture: step DAGs with dependencies, multi-agent 
contracts, quality gates with self-verification loops, per-step tool permissions, fallback 
escalation chains, and workflow-level composition. The focus is on how multiple steps and 
agents coordinate their reasoning.

**Use BAML** when you need type-safe structured outputs from individual LLM functions. 
**Use LOGIC.md** when you need to declare the reasoning flow, dependencies, and contracts 
across a multi-step or multi-agent pipeline.

A BAML function could be the implementation behind a LOGIC.md step. They compose naturally.
```

---

## Part 2: Technical Improvements

### 2.1 Spec Separation (Protocol-Shaped Design)

**Goal**: Make the spec fully separable from the reference implementation so that someone could implement a LOGIC.md parser in Python, Rust, or Go using only the spec document.

**Actions:**

1. **Formalize docs/SPEC.md as the canonical, implementation-free specification**
   - Remove any TypeScript-specific language
   - Add a "Conformance" section defining what a compliant parser MUST, SHOULD, and MAY do (RFC 2119 language)
   - Add a "Versioning" section explaining semver for the spec itself (minor = additive only, major = breaking)
   - Add a "Test Suite" section referencing canonical test fixtures that any implementation can validate against

2. **Create a canonical test fixture suite**
   - Directory: `spec/fixtures/` (separate from package test fixtures)
   - Each fixture: a `.logic.md` file + expected parse result as `.json`
   - Categories: valid specs, invalid specs (with expected error codes), edge cases
   - Any implementation in any language can run these fixtures to verify conformance
   - This is the single most important thing for protocol-shaped design

3. **Publish JSON Schema as standalone artifact**
   - Currently lives in `packages/core/src/schema.ts` as TypeScript
   - Extract to `spec/schema.json` as the canonical, language-independent schema
   - The TypeScript version becomes a consumer of the canonical schema, not the source of truth

4. **Add `.well-known` discovery pattern documentation**
   - Document how a project or agent could expose its LOGIC.md spec at a known path
   - Not a requirement — just a convention: `.well-known/logic.md` or `logic.md` at project root
   - This mirrors A2A's Agent Card pattern without requiring protocol infrastructure

### 2.2 Runtime Execution Engine

**The biggest gap**: LOGIC.md compiles specs to prompt segments but doesn't execute them. This means adoption requires building your own runtime (which is what Modular9 does). A reference runtime would dramatically lower the barrier.

**Phased approach:**

1. **Phase 1: Dry-run executor** (no LLM calls)
   - Takes a compiled workflow + mock inputs
   - Walks the DAG, validates contracts at each edge, runs quality gate expressions
   - Outputs: execution trace showing what would happen
   - This is the `logic-md test` command on steroids

2. **Phase 2: Reference executor with pluggable LLM adapter**
   - Define an `LLMAdapter` interface: `execute(prompt: string, options: LLMOptions): Promise<LLMResponse>`
   - Ship adapters for Claude API, OpenAI API, Ollama
   - The executor walks the DAG, calls the adapter at each step, validates contracts, handles retries/fallback
   - This is the killer feature that makes LOGIC.md usable without Modular9

3. **Phase 3: Streaming execution with observability**
   - Event emitter pattern for step start/complete/fail/retry
   - OpenTelemetry-compatible trace export
   - This is what makes it enterprise-interesting

### 2.3 Framework Adapters

**Priority order based on adoption and fit:**

1. **LangGraph adapter** (highest impact, but experimental)
   - `fromLogicMd(spec)` → returns a LangGraph `StateGraph` with nodes and edges wired from the LOGIC.md DAG
   - Existing LangGraph users can drop in a `.logic.md` file and get a graph without hand-wiring
   - **Budget as a 4-6 week experiment, not a guaranteed win.** LangGraph's own config story is evolving and they may not want a competing format layered on top. BAML tried a similar adapter strategy with slow results. Validate demand before going deep.

2. **CrewAI adapter**
   - `fromLogicMd(spec)` → returns CrewAI `Agent` + `Task` definitions with contracts mapped to expected outputs
   - CrewAI already uses YAML — the mental model is similar

3. **Python SDK**
   - Direct port of `@logic-md/core` to Python
   - Same parse → validate → compile pipeline
   - Uses the canonical JSON Schema and test fixtures to ensure parity

### 2.4 Benchmarks

**The critique's strongest point**: "Pipelines with LOGIC.md produce structured outputs X% more reliably than pipelines without, measured on [dataset]."

**Benchmark design:**

1. **Task set**: 10 multi-step agent tasks (code review, research synthesis, security audit, data analysis, etc.)
2. **Control**: Same tasks run with bare system prompts (no contracts, no quality gates)
3. **Treatment**: Same tasks run with LOGIC.md specs
4. **Metrics**:
   - Structured output compliance rate (does the output match the expected schema?)
   - Describing-vs-doing rate (does the output contain intent descriptions vs. actual artifacts?)
   - Pipeline completion rate (does the full DAG produce end-to-end deliverables?)
   - Contract violation rate at each edge
5. **Models**: Run on Claude Sonnet, GPT-4o, Llama 3 to show model-agnostic benefit
6. **Publication**: Results in `benchmarks/` directory with reproducible scripts

This is expensive in API calls but would be the single most convincing thing for adoption. Even a small benchmark on 3 tasks × 2 models with 10 runs each would be valuable.

---

## Part 3: Protocol-Shaped Design (Future-Proofing)

### 3.1 What "Protocol-Shaped" Means (Without Being a Protocol)

Design decisions to make now that keep the protocol door open:

1. **Spec is the source of truth, implementation is a reference**
   - Already partially true. Make it explicitly true by moving schema.json to `spec/`
   - Any sentence in SPEC.md that says "the parser does X" should say "a conformant implementation MUST do X"

2. **Versioning is spec-level, not package-level**
   - `spec_version: "1.0"` already exists. Formalize the versioning contract:
   - Minor versions (1.1, 1.2): additive fields only, all 1.0 files are valid 1.x files
   - Major versions (2.0): may remove or change fields, requires migration tooling

3. **Discovery is a convention, not a requirement**
   - Document the `.well-known/logic.md` pattern
   - Document how an MCP server could advertise its LOGIC.md spec as a resource
   - Don't build infrastructure for this — just document the pattern

4. **Interop primitives exist but aren't mandated**
   - `contracts.inputs` and `contracts.outputs` already follow the A2A capability advertisement pattern
   - Document this alignment explicitly
   - An agent that publishes its LOGIC.md is advertising its reasoning contract to other agents

### 3.2 What Would Make It Actually Become a Protocol

These are NOT actions to take now. These are conditions to watch for:

1. **External implementation**: Someone writes a Python or Rust parser that passes the canonical test suite. This is the single strongest signal.
2. **Framework integration**: LangGraph, CrewAI, or another framework adds native LOGIC.md support (not just our adapter, but theirs).
3. **Multi-vendor interest**: Two or more AI companies or framework teams express interest in standardizing.
4. **Governance need**: When there are enough stakeholders that spec changes require a process, it's time for a governance model.

At that point, the path is: RFC process → governance body (foundation or working group) → formal protocol specification. But none of that should happen until condition 1 is met.

### 3.3 Protocol Primitives to Design Now

Even without protocol status, these primitives are worth having:

1. **Capability advertisement**: A LOGIC.md file IS a capability advertisement. Document this: "Any agent that publishes a LOGIC.md file is declaring: here are my inputs, outputs, reasoning strategy, quality guarantees, and failure modes."

2. **Contract negotiation pattern**: When Agent A's `contracts.outputs` matches Agent B's `contracts.inputs`, they can compose. Document the matching algorithm even if no runtime enforces it yet.

3. **Spec fingerprinting**: `sha256` hash of the YAML frontmatter as a stable identifier. Two agents using the same LOGIC.md can be verified as reasoning-identical. Useful for auditing and compliance.

---

## Part 4: Ecosystem & Distribution

### 4.1 npm Publishing (Immediate)

**Blocker for everything else.** Must happen first.

1. Register `@logic-md` scope on npmjs.com
2. Publish `@logic-md/core`, `@logic-md/cli`, `@logic-md/mcp`
3. Verify `npx @logic-md/cli` and `npx @logic-md/mcp` work without local install
4. Add GitHub Actions for automated publishing on tag

### 4.2 GitHub Action for CI

```yaml
# .github/workflows/logic-md.yml
- uses: logic-md/validate-action@v1
  with:
    files: '**/*.logic.md'
    strict: true
```

Teams can validate LOGIC.md files in PRs. Low effort, high adoption signal.

### 4.3 VSCode Extension

- Syntax highlighting for `.logic.md` files (YAML frontmatter + markdown body)
- Inline validation errors from `@logic-md/core`
- Hover documentation for spec fields
- Template snippets
- This is the developer experience that makes the format feel real

### 4.4 n8n Community Node (Nice-to-Have)

**What it would do:**
- `logic-md-validate` node: validate a LOGIC.md spec as part of an n8n workflow
- `logic-md-compile` node: compile a spec to prompt segments
- `logic-md-execute` node: (requires Phase 2 runtime) execute a LOGIC.md workflow within n8n

**Why it's interesting but not priority:**
- n8n's audience is workflow automation, not agent reasoning
- The overlap is real (both deal with DAGs and step execution) but the value prop is unclear until the runtime exists
- Revisit after the reference executor ships

### 4.5 Documentation Site (logic-md.org)

- Getting started guide
- Spec reference (rendered from SPEC.md)
- Template gallery
- Framework adapter docs
- Benchmark results
- "Designed for protocol evolution" section explaining the governance path

---

## Part 5: Competitive Positioning Summary

### Honest Elevator Pitch

> LOGIC.md is a portable file format for declaring how AI agents reason — step dependencies, contracts between agents, quality gates, and fallback policies — in YAML frontmatter that travels with your code. It's framework-agnostic, model-agnostic, and designed so reasoning contracts are auditable, versionable, and enforceable rather than buried in imperative code.

### What We Claim (Defensible)

- First portable, markdown-based reasoning specification format (true, defensible)
- Framework-agnostic and model-agnostic (true, by design)
- Contracts-first approach that addresses the describing-vs-doing failure mode (true, validated)
- Complements existing tools: BAML for output schemas, DSPy for prompt optimization, MCP for tool connectivity, A2A for agent communication (honest, positions correctly)

### What We Don't Claim

- We did not invent output contracts, execution mandates, or structured prompting
- We are not the only declarative approach (BAML, DSPy, Instructor exist)
- We do not yet have external production adopters
- We do not yet have benchmarks proving quantitative improvement
- We are not a protocol (yet)

### Comparison Matrix (Updated)

| Project | Format | Portable | Reasoning Flow | Output Contracts | Multi-Agent | Framework-Agnostic |
|---------|--------|----------|---------------|-----------------|-------------|-------------------|
| **LOGIC.md** | Markdown/YAML | Yes | Yes (DAGs, strategies) | Yes | Yes (edges, joins) | Yes |
| **BAML** | Custom DSL | Yes (codegen) | No | Yes (strong) | No | Yes |
| **DSPy** | Python code | No | Partial (modules) | Yes (signatures) | Partial | Yes (model-agnostic) |
| **Instructor** | Library | Yes (multi-lang) | No | Yes (Pydantic) | No | Yes |
| **LangGraph** | Python code | No | Yes (StateGraph) | Partial | Yes | No |
| **CrewAI** | YAML + Python | Partial | Partial | Partial | Yes | No |
| **A2A Protocol** | Protocol spec | Yes | No (communication only) | Yes (Agent Card) | Yes | Yes |

LOGIC.md's unique position: the only project that combines portable file format + reasoning flow specification + multi-agent contracts. That's the defensible claim.

---

## Part 6: Priority Ordering

### Phase 0: Ship Honest (Week 1-2)
1. Fix README language per Section 1.1
2. Add BAML comparison section
3. Reframe case study with technique acknowledgment
4. Update comparison table
5. Publish to npm

### Phase 1: Protocol-Shape the Spec (Week 3-4)
1. Extract `spec/schema.json` from TypeScript
2. Create `spec/fixtures/` canonical test suite
3. Add Conformance section to SPEC.md
4. Add versioning contract to SPEC.md
5. Document `.well-known` discovery pattern

### Phase 2: Make It Usable (Month 2-3)
1. Dry-run executor (Phase 1 of runtime)
2. GitHub Action for CI validation
3. CLI test suite (close the testing gap)
4. Benchmark suite (even small: 3 tasks × 2 models) — **commit to publishing results regardless of outcome. If LOGIC.md barely moves the needle on a strong baseline, publish that too. Marketing benchmarks get dismissed; honest ones build trust.**
5. **Identify and recruit one external implementer** — someone to write a Python parser that passes the canonical test suite. Could be a bounty, a personal ask to a known agent-tooling dev, a conference lightning talk, or a "help wanted" issue with clear scope. The test fixtures from Phase 1 are necessary but not sufficient — without an actual person committed to implementing, "protocol" stays aspirational.

### Phase 3: Framework Bridge (Month 3-4)
1. LangGraph adapter
2. Python SDK (using canonical test fixtures for parity)
3. VSCode extension

### Phase 4: Ecosystem (Month 4+)
1. Documentation site
2. Reference executor with LLM adapters
3. Template marketplace
4. n8n community node (if runtime exists)
5. CrewAI adapter

### Phase 5: Protocol Evolution (When Ready)
- Triggered by: first external implementation passing the canonical test suite
- Actions: RFC process, governance model, formal protocol spec

---

## Appendix: The Protocol Question

**Can LOGIC.md become a protocol like MCP or A2A?**

Yes, but not yet and not in the same way.

**MCP** is a communication protocol: it defines how agents talk to tools over a transport layer (stdio, HTTP/SSE). Its primitives are requests, responses, and tool schemas. It succeeded because it solved a universal problem (connecting any agent to any tool) and got multi-vendor backing fast.

**A2A** is a communication protocol: it defines how agents talk to each other. Its primitives are Agent Cards, Tasks, Messages, and Artifacts over HTTP/JSON-RPC.

**LOGIC.md** would be a **specification protocol**: it defines how agents declare their reasoning contracts. Its primitives are specs, steps, contracts, quality gates, and DAGs. It's closer to OpenAPI (which defines API contracts) than to HTTP (which defines transport). OpenAPI became a standard not by being a protocol but by being the spec that every API tool agreed to read and write.

**The path**: LOGIC.md → adopted format → canonical test suite → multiple implementations → de facto standard → formal specification protocol. This mirrors OpenAPI's trajectory more than MCP's.

**What makes this plausible**: The agent tooling space is fragmenting fast. Every framework has its own way of defining agent reasoning. A portable, framework-agnostic contract format that any tool can read is the same value proposition that OpenAPI provided for REST APIs. The timing is right. The question is adoption, not design.

**What could kill it**: If BAML expands into reasoning flow (not just output contracts), or if a major framework (LangGraph, CrewAI) ships its own portable spec format, the window closes. Speed to external adoption matters.
