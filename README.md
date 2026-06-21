# llmwiki

A small command-line tool for the **LLM Wiki** pattern — an LLM-maintained
documentation wiki built on Andrej Karpathy's "LLM Wiki" idea, where source
material lives immutably in `raw/`, a derived markdown knowledge base lives in
`wiki/`, and a `CLAUDE.md` contract governs how the wiki is written and kept
honest (INGEST / QUERY / LINT operations, with [qmd](https://github.com/tobi/qmd)
as the local search layer).

`llmwiki` does the two mechanical jobs in that workflow:

- **`init`** — scaffold a fresh wiki repo (the `raw/`, `wiki/`, `CLAUDE.md`,
  `.gitignore` skeleton).
- **`lint`** — check an existing wiki against the contract's §6 checklist:
  frontmatter validity, broken wikilinks, orphan pages, index coverage,
  provenance, and duplicate titles. Exit code is non-zero on errors, so it
  drops straight into CI or a pre-commit hook.

It also thinly wraps qmd for `index` and `search`, so the whole loop is one CLI.

## Install

```bash
npm install        # installs deps and builds (via the prepare script)
npm link           # optional: put `llmwiki` on your PATH
```

Or run it without linking:

```bash
node dist/cli.js <command>
```

Requires Node 20+.

## Usage

```
llmwiki <command> [options]
```

### `init [dir]` — scaffold a wiki repo

Lays down the starter skeleton into `dir` (default: current directory):

```
CLAUDE.md          schema + operating rules (the contract)
.gitignore         ignores the generated .qmd/ index
raw/
  README.md        explains the append-only ground-truth rule
  sources/         where ingested source material goes
wiki/
  index.md         the catalog / table of contents
  log.md           append-only operation log
  overview.md      the 5-minute orientation page
  components/ concepts/ decisions/ runbooks/ interfaces/
```

Existing files are skipped unless you pass `--force`. Use `--dry-run` to preview.

```bash
llmwiki init my-wiki
llmwiki init . --dry-run
```

### `lint` — check the wiki against the contract

Searches upward from the current directory for the wiki repo (or pass
`--root <dir>`) and runs every mechanical check from `CLAUDE.md` §6:

| Rule              | Severity | What it catches                                                        |
| ----------------- | -------- | ---------------------------------------------------------------------- |
| `frontmatter`     | error    | missing/empty `title`/`type`/`status`/`updated`; invalid `type`/`status` |
| `broken-link`     | error    | a `[[wikilink]]` that resolves to no page                              |
| `orphan`          | error    | a page not reachable from `index.md` via any wikilink                  |
| `index-coverage`  | warn     | a page reachable only indirectly, not listed directly in `index.md`   |
| `provenance`      | warn     | a `component`/`interface`/`decision` page with empty `sources:` that isn't `unverified` |
| `source-link`     | warn     | an inline `[[source:...]]` pointing at a file that doesn't exist       |
| `duplicate-title` | warn     | two pages sharing a title (a duplication smell)                        |
| `status`          | info     | pages already marked `stale` / `superseded`                            |

Links inside fenced code blocks, HTML comments, and inline-code spans are
treated as illustrative and ignored.

```bash
llmwiki lint                 # human-readable report
llmwiki lint --json          # machine-readable findings
llmwiki lint --strict        # exit non-zero on warnings too
```

Exit codes: `0` clean · `1` lint errors (or warnings under `--strict`) ·
`2` usage/setup problem (e.g. no wiki found).

### `index` / `search` — qmd passthrough

```bash
llmwiki index                      # qmd index wiki/ --db .qmd
llmwiki search "how does X work"   # qmd search "..." --db .qmd
```

Both look for a global `qmd` install; add `--npx` to run it via
`npx @tobilu/qmd` without installing. (The `.qmd/` index is gitignored.)

## How it fits the LLM Wiki workflow

`llmwiki` is the deterministic guardrail around the LLM's judgement. The LLM
does the writing, linking, and summarizing (INGEST/QUERY); `llmwiki lint` then
mechanically verifies the structural invariants the contract promises, so
broken links, orphans, and unsourced claims are caught before they rot. Run it
at the end of every ingest and in CI.

## Development

```bash
npm run build      # compile src/ -> dist/
npm test           # compile + run the node:test suite
npm run lint:self  # lint this repo's own wiki/ (after scaffolding one)
```

The linter's logic lives in `src/lint/rules.ts`; the wiki/frontmatter/wikilink
parsing in `src/lib/`. Tests are in `test/`.
