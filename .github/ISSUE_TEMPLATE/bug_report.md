---
name: Bug report
about: Report a defect in @logic-md/core, @logic-md/cli, @logic-md/mcp, or the spec
title: ""
labels: bug
assignees: ""
---

## Summary

<!-- One sentence describing the unexpected behaviour. -->

## Environment

- **Spec version in file:** <!-- e.g. "1.0" -->
- **Package version:** <!-- output of `npm list -g @logic-md/cli` or `npm list @logic-md/core` -->
- **Node version:** <!-- output of `node --version` -->
- **OS:** <!-- e.g. macOS 14.5, Ubuntu 22.04 -->

## Minimal reproduction

<!-- Smallest LOGIC.md file that demonstrates the issue. -->

```yaml
---
spec_version: "1.0"
name: reproduce-bug
---
```

## Steps to reproduce

1. Save the above as `bug.logic.md`
2. Run `logic-md validate bug.logic.md`
3. <!-- observe -->

## Expected behaviour

<!-- What you expected to happen. -->

## Actual behaviour

<!-- What actually happened. Include any error output verbatim. -->

```text
<!-- paste output here -->
```

## Additional context

<!-- Links to related issues, spec sections, or conformance fixtures. -->
