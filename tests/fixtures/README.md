# Synthetic Excel Fixture Set

This directory contains deterministic, synthetic-only workbook evidence for audit remediation.

- `source/` contains format-sensitive binary `.xlsx` and BIFF8 `.xls` fixtures.
- `expected/` contains stable projections or target snapshots.
- `manifest.json` records SHA-256, purpose, status, and acceptance coverage.
- `generateFixtures.mjs` regenerates the binary files from explicit synthetic labels and values.

Rules:

1. Never copy a user workbook or real experimental labels into this directory.
2. Keep large and combinatorial performance inputs generated in tests rather than committed as binary files.
3. Do not update a fixture hash without reviewing the workbook structure and expected projection.
4. `known-red` means the fixture captures a documented audit defect; the normal test suite uses `it.todo` until its remediation Phase.
5. The two equivalent fixtures must remain a genuine OOXML ZIP workbook and a genuine BIFF8 compound workbook.

Regenerate from the repository root:

```powershell
node tests/fixtures/generateFixtures.mjs
```
