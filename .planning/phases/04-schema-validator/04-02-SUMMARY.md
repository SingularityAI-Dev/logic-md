---
phase: 04-schema-validator
plan: 02
subsystem: validation
tags: [vitest, yaml, line-numbers, ajv, gray-matter]

requires:
  - phase: 04-schema-validator/04-01
    provides: "Schema validator with ajv + yaml source position mapping"
provides:
  - "Line number accuracy tests proving PARS-04 compliance"
  - "Validated barrel exports for validate() and all validation types"
affects: [05-expression-engine]

tech-stack:
  added: []
  patterns: ["gray-matter .matter leading newline compensation in YAML parsing"]

key-files:
  created: []
  modified:
    - packages/core/validator.test.ts
    - packages/core/validator.ts

key-decisions:
  - "Strip leading newline from gray-matter .matter before YAML parseDocument to fix off-by-one line numbers"

patterns-established:
  - "Line number tests use exact file-line assertions to verify source mapping accuracy"

requirements-completed: [PARS-04]

duration: 3min
completed: 2026-03-31
---

# Phase 04 Plan 02: Line Number Accuracy Tests and Barrel Exports Summary

**Line number accuracy tests proving PARS-04 compliance, with off-by-one fix in gray-matter YAML offset**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T07:24:38Z
- **Completed:** 2026-04-01T07:27:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 4 targeted line number accuracy tests covering nested properties, frontmatter offset, distinct error lines, and deep path resolution
- Fixed off-by-one bug in validator caused by gray-matter `.matter` including a leading newline character
- Verified barrel exports already complete from 04-01 (validate + all validation types via `export *`)
- Full test suite (30 tests), typecheck, and lint all pass clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add line number accuracy tests and edge case coverage** - `f743e64` (test + fix)
2. **Task 2: Update barrel exports and run full test suite** - No changes needed (barrel already complete from 04-01)

## Files Created/Modified
- `packages/core/validator.test.ts` - Added 4 line number accuracy tests in new describe block
- `packages/core/validator.ts` - Fixed leading newline strip on gray-matter .matter for correct YAML line positions

## Decisions Made
- Strip leading `\n` from `result.matter` before `parseDocument()` rather than adjusting FRONTMATTER_OFFSET, since the newline is a gray-matter artifact not part of the actual YAML content

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed off-by-one line numbers caused by gray-matter leading newline**
- **Found during:** Task 1 (line number accuracy tests)
- **Issue:** gray-matter's `.matter` property starts with `\n`, causing all YAML line positions to be inflated by 1
- **Fix:** Added `.replace(/^\n/, "")` to strip the leading newline before passing to `parseDocument`
- **Files modified:** packages/core/validator.ts
- **Verification:** All 4 line number tests pass with exact file-line assertions
- **Committed in:** f743e64 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for correct line numbers. No scope creep.

## Issues Encountered
- Task 2 barrel exports were already complete from 04-01 (`export { validate }` and `export * from "./types.js"` already in index.ts). No changes needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema validator fully tested with line number accuracy verified
- All validation types and validate() function exported from @logic-md/core
- Ready for Phase 05 (Expression Engine)

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 04-schema-validator*
*Completed: 2026-03-31*
