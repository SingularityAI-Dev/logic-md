---
phase: 02-type-system-and-json-schema
plan: 02
subsystem: validation
tags: [json-schema, ajv, draft-07, validation]

requires:
  - phase: 02-type-system-and-json-schema/01
    provides: TypeScript type hierarchy (LogicSpec and all sub-types)
provides:
  - JSON Schema draft-07 file with 34 definitions mirroring TypeScript types
  - Schema loader function (getSchema) for disk-based schema access
  - Cached ajv validator factory (createValidator) for runtime validation
affects: [04-schema-validator, cli-validate-command]

tech-stack:
  added: [ajv-formats]
  patterns: [createRequire for CJS interop under verbatimModuleSyntax, readFileSync + import.meta.url for co-located JSON loading]

key-files:
  created:
    - packages/core/schema.json
    - packages/core/schema.ts
    - packages/core/schema.test.ts
  modified:
    - packages/core/index.ts
    - packages/core/package.json

key-decisions:
  - "Used createRequire for ajv-formats CJS interop under verbatimModuleSyntax + nodenext"
  - "additionalProperties: false on all definitions for strict validation"

patterns-established:
  - "CJS interop pattern: createRequire(import.meta.url) for packages with default exports that fail under verbatimModuleSyntax"
  - "Schema loading pattern: readFileSync + dirname(fileURLToPath(import.meta.url)) for co-located JSON files"

requirements-completed: [PARS-02]

duration: 13min
completed: 2026-03-31
---

# Phase 2 Plan 2: JSON Schema & Validator Summary

**JSON Schema draft-07 with 34 definitions mirroring TypeScript types, plus cached ajv validator factory with allErrors mode**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-01T03:04:42Z
- **Completed:** 2026-04-01T03:18:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete JSON Schema draft-07 file (890 lines) with definitions for all 34 LogicSpec sub-types
- Schema loader using readFileSync + import.meta.url for portable path resolution
- Cached ajv validator factory with allErrors: true and strict: true
- 7 validation tests covering valid fixtures, invalid fixtures, enum checks, and allErrors mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JSON Schema draft-07 for LogicSpec** - `8b23777` (feat)
2. **Task 2: Create schema loader, update exports, and add validation tests** - `b49e45c` (feat)

## Files Created/Modified
- `packages/core/schema.json` - Complete JSON Schema draft-07 with 34 definitions
- `packages/core/schema.ts` - Schema loader (getSchema) and validator factory (createValidator)
- `packages/core/schema.test.ts` - 7 validation tests
- `packages/core/index.ts` - Re-exports createValidator and getSchema
- `packages/core/package.json` - Added ajv-formats dependency

## Decisions Made
- Used `createRequire(import.meta.url)` for ajv-formats import because its CJS default export does not resolve correctly under verbatimModuleSyntax + nodenext moduleResolution. Named import from ajv works fine.
- Set `additionalProperties: false` on all schema definitions for strict validation per research recommendation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CJS interop for ajv and ajv-formats under verbatimModuleSyntax**
- **Found during:** Task 2 (schema loader implementation)
- **Issue:** `import Ajv from "ajv"` and `import addFormats from "ajv-formats"` fail TypeScript compilation under verbatimModuleSyntax + nodenext because both are CJS packages. Default imports are not constructable/callable.
- **Fix:** Used named import `{ Ajv }` from ajv (which exports the class as named). Used `createRequire(import.meta.url)` for ajv-formats which only has a default export.
- **Files modified:** packages/core/schema.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** b49e45c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** CJS interop fix necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the CJS interop deviation noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- JSON Schema and validator are ready for Phase 4 (Schema Validator)
- All exports available from @logic-md/core barrel
- 11 total tests pass (4 from index.test.ts, 7 from schema.test.ts)

---
*Phase: 02-type-system-and-json-schema*
*Completed: 2026-03-31*
