# Contributing to @logic-md/langgraph-adapter

This is an experimental, short-lived project (4-6 weeks). Contributions are welcome, but scope is intentionally limited.

## What to Contribute

### Good Contributions (In Scope)

- **Bug reports** for Phase 1 features (DAG→graph mapping, node/edge structure)
- **Test cases** for edge cases in step compilation or DAG resolution
- **Documentation improvements** and usage examples
- **Type improvements** and stricter TypeScript checks
- **Feedback** on the API design and approach

### Not Recommended (Out of Scope)

- **Feature requests** for branching, quality gates, or retry loops (Phase 2+)
- **Refactoring** that changes the architecture
- **Performance optimization** (not yet a priority)
- **Integration with LangGraph runtime** (deferred to Phase 3)

## Development Setup

```bash
cd adapters/langgraph
npm install

# Build
npm run build

# Test
npm test

# Type check
npm run typecheck
```

## Code Standards

The adapter follows the project's standards (see [CLAUDE.md](../../CLAUDE.md)):

- **TypeScript strict mode** with no `any` types
- **Biome** for linting and formatting
- **Vitest** for testing with ~80% coverage threshold
- **No external dependencies** beyond @logic-md/core and peer deps

## Testing

All changes should include tests. Use the existing test suite as a template:

```bash
npm test
```

Key test patterns:

1. **Single-step specs** → verify 1 node, entry→node→END
2. **Multi-step DAGs** → verify edges and DAG levels
3. **Metadata capture** → verify quality gates, retry policies, etc.
4. **Error handling** → verify strict mode behavior

## Before You Submit

- [ ] Run `npm test` and confirm all tests pass
- [ ] Run `npm run typecheck` and fix any errors
- [ ] Run `npm run lint` (or use Biome) and fix violations
- [ ] Check that your changes don't break existing usage examples

## The Experimental Nature

This adapter is explicitly a proof-of-concept. During its 4-6 week lifespan:

- **API may change** between versions (semver prerelease: `1.0.0-experimental.N`)
- **Major features may be deferred** (branching, gates, retries → Phase 2)
- **Documentation is evolving** (not final)

If you're relying on this for production, understand that it may change significantly.

## Questions?

Open an issue or discussion in the main repository. For architectural questions, see the Phase history in `.planning/ROADMAP.md`.
