# LOGIC.md Implementer Guide

**Build portable AI reasoning specs. For any language, any framework.**

This guide is for developers who want to build a LOGIC.md parser, validator, or runtime in Python, Rust, Go, Java, or any other language. It's also our recruitment strategy for growing a multi-language implementation ecosystem.

---

## Part 1: Why Implement LOGIC.md

### The Value Proposition

You're building a framework or pipeline that needs to specify how agents reason — strategy selection, step dependencies, contracts, quality gates, fallback policies. Right now, you hardcode it. LOGIC.md lets you declare it.

LOGIC.md is to agent reasoning what OpenAPI is to HTTP APIs: a vendor-neutral, language-agnostic specification. Implement the spec once, parse it in any language, and your agents inherit portable reasoning definitions.

### Integration Scenarios

**Python ML pipelines** — LangChain, LlamaIndex, Transformers pipelines. Use LOGIC.md to declare reasoning DAGs alongside tool definitions. Your agents load reasoning contracts from `.logic.md` files, same way they load `SKILL.md` tool specs.

**Rust edge runtimes** — Serverless functions, embedded AI, low-latency inference. Parse LOGIC.md at startup, compile to a decision graph, execute without runtime overhead. No Python, no external dependencies.

**Go microservices** — Multi-agent workflows, orchestration layers. LOGIC.md defines how agents coordinate, what they output, when they retry. Lightweight, portable, survivable across service boundaries.

**JavaScript/Node.js** — Reference implementation exists in TypeScript; contribute Go bindings, community Deno port, or Node native addon.

**JVM ecosystems** — Spring AI, LangChain4j, Jakarta frameworks. Port the validator and let your agents inherit conformant reasoning specs.

### It's a Format, Not a Runtime

LOGIC.md defines *what* agents think, not *how* they execute. You implement the interpreter that transforms LOGIC.md declarations into actual reasoning behavior. We provide the spec and test suite. You provide the execution engine.

Think of it like JSON Schema: the format is static and independent. Implementations are infinite.

---

## Part 2: Implementation Guide

### What You Need to Build

**Minimum conformance** (to claim the badge):

1. **YAML frontmatter parser** — Extract the `---` delimited YAML from a `.logic.md` file
2. **JSON Schema validator** — Validate parsed YAML against the canonical schema at `spec/schema.json`
3. **Fixture test runner** — Pass all 18 tests from `spec/fixtures/` (7 valid, 7 invalid, 4 edge cases)

**Recommended** (for production use):

4. **Compiler** — Convert LOGIC.md to an AST or decision graph
5. **Dry-run executor** — Simulate reasoning paths to catch errors before runtime
6. **Error reporter** — Return validation errors with JSON pointer paths (for IDE integration)

**Optional** (for frameworks):

7. **Framework adapters** — Integrate with your runtime (LangChain agent loop, Go service mesh, etc.)

### Step-by-Step Conformance Process

#### Step 1: Parse YAML Frontmatter

Read the `.logic.md` file and extract content between the opening and closing `---` delimiters.

```python
# Python example
import re
import yaml

def parse_logic_file(path: str) -> dict:
    with open(path) as f:
        content = f.read()
    
    # Extract frontmatter between --- delimiters
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        raise ValueError("No YAML frontmatter found")
    
    frontmatter = yaml.safe_load(match.group(1))
    return frontmatter
```

Use any YAML library (js-yaml, PyYAML, serde_yaml). The YAML is valid YAML 1.2.

#### Step 2: Validate Against JSON Schema

Download or reference the schema at `spec/schema.json`. Use a JSON Schema Draft-07 validator in your language.

```python
# Python example
import jsonschema

schema = load_schema("spec/schema.json")
try:
    jsonschema.validate(parsed_yaml, schema)
    print("Valid")
except jsonschema.ValidationError as e:
    print(f"Error at {e.json_path}: {e.message}")
```

Popular validators:
- **Python**: `jsonschema`, `pydantic` (strict)
- **Rust**: `serde_json` + `jsonschema` crate
- **Go**: `github.com/xeipuuv/gojsonschema`
- **JavaScript**: `ajv` (what the reference implementation uses)
- **Java**: `everit-org/json-schema`

#### Step 3: Run the Fixture Test Suite

The conformance test suite is at `spec/fixtures/`.

```
spec/fixtures/valid/         # Must all validate successfully
spec/fixtures/invalid/       # Must all fail validation
spec/fixtures/edge-cases/    # Must be handled per .expected.json
```

Each fixture is a pair:
- `*.logic.md` — the input file
- `*.expected.json` — the expected result

Example:
```json
{
  "valid": true,
  "parsed": {
    "spec_version": "1.0",
    "name": "minimal"
  }
}
```

For invalid fixtures:
```json
{
  "valid": false,
  "errors": [
    {
      "path": "/spec_version",
      "message": "must match enum",
      "keyword": "const"
    }
  ]
}
```

Write a test runner that:
1. Loads each fixture pair
2. Parses and validates the `.logic.md` file
3. Compares results against `.expected.json`
4. Reports pass/fail

```python
# Python pseudo-code
def test_fixtures():
    for fixture in glob("spec/fixtures/**/*.logic.md"):
        expected_file = fixture.replace(".logic.md", ".expected.json")
        expected = json.load(open(expected_file))
        
        try:
            result = parse_and_validate(fixture)
            assert result["valid"] == expected["valid"]
            if expected["valid"]:
                assert result["parsed"] == expected["parsed"]
            else:
                assert result["errors"] == expected["errors"]
            print(f"✓ {fixture}")
        except AssertionError as e:
            print(f"✗ {fixture}: {e}")
```

**All 18 tests must pass to claim conformance.**

#### Step 4: Claim the Badge

Once all tests pass:

1. **Add your implementation** to a registry table in the root `README.md`
2. **Open a PR** linking to your GitHub repo
3. **We verify** by running your test suite against the fixtures
4. **Badge granted** — include the conformance badge in your repo:

```markdown
[![LOGIC.md Conformant](https://img.shields.io/badge/LOGIC.md-conformant-7c6fe0)](https://github.com/SingularityAI-Dev/logic-md)
```

---

### Reference Documentation

- **Format specification**: [`docs/SPEC.md`](../docs/SPEC.md) — complete reference for all LOGIC.md fields
- **Fixture format**: [`spec/fixtures/README.md`](../spec/fixtures/README.md) — explains expected result structure
- **JSON Schema**: [`spec/schema.json`](../spec/schema.json) — canonical validation schema (Draft-07)
- **Spec README**: [`spec/README.md`](../spec/README.md) — quick implementer checklist

### TypeScript Reference Implementation

The reference implementation is in `packages/core`:

- **Parser** — `src/parser.ts` (YAML frontmatter extraction)
- **Validator** — `src/validator.ts` (schema validation via ajv)
- **Compiler** — `src/compiler.ts` (AST + DAG resolution)
- **Test suite** — `src/__tests__/` (307 tests, 95.9% coverage)

Use it as a behavior reference, not a code port.

---

## Part 3: Recruitment Channels

### Where to Find Implementers

**Python ecosystem:**
- LangChain community (Discord, discussions)
- LlamaIndex contributors
- PyPI trending (data science / AI)
- Reddit: r/Python, r/MachineLearning, r/LanguageModels

**Rust ecosystem:**
- are-we-ai-yet.com (Rust AI/ML registry)
- Hugging Face Candle community
- Mistral Rust SDKs
- GitHub discussions on `rust-ml`, `burn`, `llama.rs`

**Go ecosystem:**
- LangChainGo contributors
- Go concurrency forums (Gophers Slack)
- GitHub discussions on `go-openai`, Go microservices channels

**General:**
- GitHub Discussions (your repo)
- Dev.to, Hacker News (when announcing)
- Conference talks (PyData, RustConf, GopherCon)

### Outreach Templates

**GitHub Discussions Post:**
```
Title: Build a LOGIC.md [Python/Rust/Go] Implementation

We're recruiting implementers for LOGIC.md, a portable reasoning 
format for AI agents. If you maintain a [framework] library or pipeline, 
we'd like your help building a conformant parser.

- No external dependencies required (YAML + JSON Schema)
- ~500 lines of code to achieve full conformance
- Passive maintenance (spec rarely changes)
- Your framework gets agent reasoning specs for free

Interested? Start here: [IMPLEMENTER-GUIDE.md link]
```

**Discord/Community Pitch:**
```
Hey folks, we're looking for maintainers to implement LOGIC.md 
in [language]. It's a portable specification for AI agent reasoning 
(like OpenAPI for agent thinking). Turns out this is useful for 
LangChain, LlamaIndex, Candle, etc.

If you'd like to adopt it for your framework, we offer:
- Early listing on our README
- Co-maintainer status for quality implementations
- Input on the roadmap
- None of the heavy lifting (it's 18 tests)

Interested? Read the implementer guide: [link]
```

**Email to Maintainers:**
```
Subject: Implement LOGIC.md for [Framework/Language]

Hi [Name],

We've built LOGIC.md, a portable reasoning specification for AI agents 
(like JSON Schema for how agents think). We're recruiting implementers 
for [Python/Rust/Go] to integrate it with [Framework].

The spec is stable, the tests are clear, and implementations take ~1-2 
weeks. We offer early listing, co-maintainer status, and input on what 
features matter most for your use case.

Want to chat? [calendar link or email]
```

### What We Offer

- **Early listing** on the implementations table in `README.md`
- **Co-maintainer status** for quality implementations
- **Shared roadmap input** — if you implement first, you shape what LOGIC.md becomes
- **Technical support** — we answer questions during implementation
- **Passive maintenance model** — no rush to update for every patch

### Success Metric

**1 non-TypeScript conformant implementation within 6 months.**

Start with Python (largest audience, easiest to recruit) or Rust (highest credibility in AI/ML infrastructure).

---

## Part 4: Conformance Badge Program

Three tiers, each with increasing scope and community value.

### Tier 1: Parser ⭐

**What you build:**
- Parse YAML frontmatter from `.logic.md` files
- Validate against `spec/schema.json`
- Pass all 18 fixture tests

**Badge:**
```markdown
![LOGIC.md Parser](https://img.shields.io/badge/LOGIC.md-parser-7c6fe0?logo=data:image/svg%2bxml;...)
```

**Maintenance:**
- Zero external dependencies (YAML + JSON Schema validator only)
- <100 lines of test code to maintain

### Tier 2: Runtime 🎯

**What you build (extends Tier 1):**
- Compile LOGIC.md to an AST or decision graph
- Resolve step DAGs and dependencies
- Dry-run execution paths
- Error reporting with JSON pointer paths

**Badge:**
```markdown
![LOGIC.md Runtime](https://img.shields.io/badge/LOGIC.md-runtime-2db88a?logo=...)
```

**Maintenance:**
- 500-1000 lines additional code
- ~30 fixture edge cases to handle

**Why it matters:**
- Frameworks using your implementation get semantic validation
- Developers can test reasoning specs without running agents
- Early error detection (contracts, DAG cycles, missing steps)

### Tier 3: Full Adapter 🚀

**What you build (extends Tier 2):**
- Framework-specific integration (e.g., LangChain agent loop)
- Runtime execution of reasoning steps
- Automatic retry, fallback, and quality gate enforcement
- Metrics and observability hooks

**Badge:**
```markdown
![LOGIC.md Adapter](https://img.shields.io/badge/LOGIC.md-[framework]-e07050?logo=...)
```

**Maintenance:**
- 1000+ lines depending on framework complexity
- Ongoing alignment with framework updates

**Why it matters:**
- Developers write LOGIC.md once, use it across frameworks
- Your framework becomes a reference runtime

### How to Claim a Badge

1. **Build** your implementation per the steps above
2. **Test** against all 18 fixtures (all must pass)
3. **Open a PR** to add your implementation to `README.md` with:
   - GitHub repo link
   - Language and badge tier
   - Quick example usage
4. **We verify** by running your test suite
5. **Badge granted** — we update `README.md` and announce

Example entry:
```markdown
| Python | [logic-md-py](https://github.com/user/logic-md-py) | Parser | ✓ All 18 fixtures |
| Rust   | [logicmd](https://github.com/user/logicmd)         | Runtime | ✓ All 18 fixtures + DAG resolution |
```

---

## Getting Started

1. **Read the spec**: Start with [`docs/SPEC.md`](../docs/SPEC.md) to understand all fields
2. **Study the fixtures**: Browse `spec/fixtures/valid/` and `spec/fixtures/invalid/` to see real examples
3. **Download the schema**: Copy `spec/schema.json` into your project
4. **Choose your language**: Pick a YAML and JSON Schema library for your ecosystem
5. **Build the parser**: ~50 lines
6. **Build the validator**: Integrate your JSON Schema validator
7. **Write the test runner**: Loop through fixtures and compare results
8. **Claim the badge**: Open a PR when all 18 tests pass

Estimated time: 1-2 weeks for a Parser implementation, 3-4 weeks for a Runtime, depending on your familiarity with the language.

Questions? Open an issue in the [main repo](https://github.com/SingularityAI-Dev/logic-md) with the `implementation` label.

---

## FAQ

**Q: Do I need to implement the compiler/runtime?**
A: No. Parser + validator is enough for conformance. Compiler and runtime are optional and valuable, but the badge doesn't require them.

**Q: Can multiple people from the same organization implement?**
A: Yes. If you have separate use cases (e.g., LangChain integration and a pure runtime), go for it.

**Q: What if the spec changes?**
A: We version spec changes separately from package versions. Minor versions (1.1, 1.2) are additive — old files stay valid. Major versions require migration tooling.

**Q: Do I have to maintain this forever?**
A: No. Maintenance is passive — the spec rarely changes. If you can't maintain anymore, transfer the repo or we'll fork it with attribution.

**Q: How do I get paid?**
A: This is volunteer work, like most open-source. If your framework company wants to sponsor, let us know.

---

**Last updated**: April 2026  
**Spec version**: 1.0  
**GitHub**: [SingularityAI-Dev/logic-md](https://github.com/SingularityAI-Dev/logic-md)
