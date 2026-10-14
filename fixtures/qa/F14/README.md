# Boundaries

`node fixtures/qa/F14/generate.mjs <temporary-output-directory>` creates exact/above value, header, column and row limits plus an over-limit key. These are generated data, not committed large blobs. Limits are a separately written oracle matching the documented v0.1 product contract; the generator does not import the core.

File bytes are exercised by browser tests with a synthetic 16 MiB + 1 buffer before parsing. Core tests should cover exact byte, cell, encoded key, configuration and report limits using lowered configurable limits where possible to keep routine tests bounded. A fixture definition is not evidence that its case has passed: see VALIDATION.md.
