---
title: Operation Log
type: concept
status: verified
sources: []
updated: 2026-06-21
---

# Operation Log

Append-only audit trail. Every INGEST and every non-trivial LINT/correction adds one line,
newest at the bottom. Never rewrite history here — if something was wrong, append a correcting
entry. Format:

```
- YYYY-MM-DD OPERATION  short description → pages touched. source: raw/sources/...
```

Operations: `INGEST` (added knowledge), `LINT` (repaired structure), `QUERY` (only logged when
it surfaces a gap or triggers a correction).

---

- 2026-06-21 INIT    repo scaffolded from the LLM Wiki + qmd pattern. Empty wiki awaiting first ingest.
