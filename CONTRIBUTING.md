# Contributing to logic-md

## Development Setup

```bash
git clone https://github.com/SingularityAI-Dev/logic-md.git
cd logic-md
npm install
```

## Commands

- `npm test` — run tests (vitest)
- `npm run lint` — check lint + format (biome)
- `npm run lint:fix` — auto-fix lint + format
- `npm run typecheck` — TypeScript type checking

## Pull Requests

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Ensure `npm test`, `npm run lint`, `npm run typecheck`, and `node spec/fixtures/run-fixtures.mjs` all pass
4. Submit a PR to `main`

## Community standards

Please see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) for the standards of behaviour expected in this project. Security vulnerabilities should be reported via [`SECURITY.md`](./SECURITY.md), not public issues.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
