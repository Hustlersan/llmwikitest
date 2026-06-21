# CLAUDE.md — Project Documentation Wiki

This repository is an **LLM-maintained wiki** for project/codebase documentation, built on
Andrej Karpathy's "LLM Wiki" pattern. **You (Claude Code) are the primary maintainer of this
wiki.** A human reads it and occasionally corrects it, but you do the writing, linking, and
upkeep.

Read this entire file before doing anything. It is the schema and the rulebook.

---

## 1. What this repo is

Three layers, kept strictly separate:

```
.
├── CLAUDE.md          ← this file: schema + operating rules (the contract)
├── raw/               ← immutable source material. APPEND-ONLY. Never edit or delete.
│   └── sources/       ← one subfolder or file per ingested source
├── wiki/              ← YOUR domain: the markdown knowledge base you build and maintain
│   ├── index.md       ← the catalog / table of contents (you keep this current)
│   ├── log.md         ← append-only operation log (every ingest/edit gets a line)
│   ├── overview.md    ← the 5-minute "what is this project" orientation page
│   ├── components/    ← one page per service / module / package
│   ├── concepts/      ← cross-cutting ideas, domain terms, patterns
│   ├── decisions/     ← architectural decisions & their rationale (ADR-style)
│   ├── runbooks/      ← how to do operational tasks (deploy, rotate keys, debug X)
│   └── interfaces/    ← APIs, schemas, contracts, event formats
└── .qmd/              ← qmd's local search index (generated; gitignored)
```

**The cardinal rule:** `raw/` is the ground truth and is **immutable**. `wiki/` is a derived,
LLM-owned interpretation of `raw/` (plus the codebase). If they ever conflict, `raw/` wins and
the wiki is wrong and must be fixed. Never edit a file under `raw/` to make it match the wiki.

---

## 2. The three operations

You perform exactly three operations. When the human gives an instruction, map it to one of these.

### INGEST — add new knowledge
Triggered by: "ingest X", "document this", "add the auth service to the wiki", pasting notes,
pointing at a file/PR/transcript, or "update the wiki for the changes in `src/billing/`".

1. **Capture the source verbatim into `raw/sources/` FIRST.** Give it a stable, descriptive
   name: `raw/sources/2026-06-21-billing-refactor-notes.md`,
   `raw/sources/auth-service-readme.md`, `raw/sources/pr-1423-rate-limiting.md`. If the source
   is the codebase itself, write a short pointer file recording exactly what you read
   (paths + commit SHA), e.g. `raw/sources/2026-06-21-billing-module-at-a1b2c3d.md`.
   **Do this even if it feels redundant** — provenance is the whole point.
2. **Read the relevant existing wiki pages** before writing. Use qmd (Section 4) to find them.
   Do not create a duplicate page for something that already exists — extend it instead.
3. **Write or update wiki pages** following the page contract (Section 3). Every claim that
   comes from a source must be traceable to that source via the `sources:` frontmatter and,
   for non-obvious claims, an inline `[[source:...]]` reference.
4. **Update `wiki/index.md`** so the new/changed page is catalogued.
5. **Append one line to `wiki/log.md`** (format in Section 5).
6. **Re-index qmd** (Section 4) so search reflects the change.
7. **Lint** (run the INGEST's changes through Section 6 checks) before declaring done.

When in doubt about whether something is true, mark it `status: unverified` rather than
asserting it. A wiki that admits uncertainty is more useful than one that lies confidently.

### QUERY — answer from the wiki
Triggered by: any question about the project ("how does billing retry work?", "why did we drop
Redis?", "what calls the notification service?").

1. **Search the wiki first** with qmd (Section 4). The wiki is the cache; use it.
2. If the wiki answers the question, **answer from the wiki and cite the page(s)** you used by
   path. If the answer required reading `raw/` or code to confirm, say so.
3. **If the wiki does NOT contain the answer, say so explicitly**, then offer to INGEST it. Do
   not silently fabricate. A query that reveals a gap is a signal to ingest, not to guess.
4. If you find the wiki is **wrong or stale** while answering, fix it (a mini-INGEST) and note
   the correction in `log.md`. Never leave known-bad information in place.

### LINT — maintain health
Triggered by: "lint the wiki", "clean up", periodically after big ingests, or on request.
See Section 6 for the full checklist. Lint never invents new knowledge; it only repairs
structure, links, duplication, staleness, and contradictions using existing sources.

---

## 3. Page contract (every file under `wiki/`)

Every wiki page is plain CommonMark markdown with YAML frontmatter:

```markdown
---
title: Billing Service
type: component            # component | concept | decision | runbook | interface
status: verified           # verified | unverified | stale | superseded
sources:                   # provenance — which raw/ files back this page
  - raw/sources/auth-service-readme.md
  - raw/sources/2026-06-21-billing-module-at-a1b2c3d.md
related:                   # wikilinks to sibling pages
  - "[[interfaces/billing-api]]"
  - "[[decisions/0007-drop-redis]]"
updated: 2026-06-21
---

# Billing Service

One-paragraph summary a newcomer can read in 30 seconds: what it is, why it exists,
where it lives in the codebase (`src/billing/`).

## Responsibilities
- Bullet the concrete things this component owns.

## How it works
Prose + small code/path references. Link out with [[components/payment-gateway]] rather
than re-explaining a neighbour. Keep each page focused on ONE thing.

## Gotchas / non-obvious
The stuff that bites people. This section earns the wiki its keep.

## Open questions
- Things you couldn't verify (mark the page status accordingly).
```

Rules:
- **One concept per page.** If a page is trying to explain two things, split it.
- **Link, don't duplicate.** Use `[[folder/page-name]]` wikilinks. If you state the same fact
  on two pages, one of them should instead link to the other.
- **Every page must be reachable** from `index.md` (directly or via another linked page). No
  orphans.
- **Cite sources.** A `component`/`interface`/`decision` page with an empty `sources:` list is
  a red flag — either find the source, read the code and add a code-pointer source, or mark it
  `status: unverified`.
- **Filenames:** lowercase, hyphenated, stable. Decisions are numbered: `decisions/0007-drop-redis.md`.
- **Write for a competent engineer new to the project.** Not for yourself, not for an expert.

---

## 4. Search with qmd (the search layer)

This repo uses **qmd** (https://github.com/tobi/qmd) as its local, on-device search engine.
qmd does hybrid BM25 + vector search over the markdown and runs fully locally. **Prefer qmd
over blind `grep`/`find`** for any "where is X documented?" question — it understands meaning,
not just exact strings.

**You must keep the index fresh.** Re-index at the end of every INGEST and after any LINT that
moves or deletes pages.

Commands (run from the repo root):

```bash
# One-time, per machine: install qmd (Node 20+). Skip if already installed.
npm install -g @tobilu/qmd        # or: npx @tobilu/qmd ...

# Build / refresh the index over the wiki (do this after every INGEST/LINT):
qmd index wiki/ --db .qmd

# Search before answering a QUERY or before writing during an INGEST:
qmd search "how does billing retry failed charges" --db .qmd

# If qmd's MCP server is wired into this Claude Code session, prefer the MCP
# `search` tool over shelling out — it's the same engine.
```

Operating rules for search:
- **Before writing any new page, search first** to avoid creating a duplicate. If a near-match
  exists, extend it.
- **Before answering any question, search first.** Treat the top results as candidate sources,
  open them, and verify before citing.
- If qmd isn't installed or the index is missing, tell the human the one command to fix it
  (`qmd index wiki/ --db .qmd`) rather than silently falling back to grep for everything.
- `.qmd/` is generated and **gitignored** — never commit the index.

---

## 5. The operation log (`wiki/log.md`)

`log.md` is **append-only**. Every INGEST and every non-trivial LINT/correction adds one line.
This is the audit trail; it lets a human (or future you) see how the wiki evolved.

Format (newest entries at the bottom):

```
- 2026-06-21 INGEST  billing refactor notes → components/billing-service.md (new),
  interfaces/billing-api.md (updated). source: raw/sources/2026-06-21-billing-refactor-notes.md
- 2026-06-21 LINT    fixed 2 broken wikilinks, merged duplicate "retry" pages into
  concepts/retry-policy.md
- 2026-06-21 QUERY   gap found: no page on dead-letter queue; flagged, awaiting source
```

Keep lines terse but specific enough to reconstruct what happened. Never rewrite history in
`log.md`; if something was wrong, append a correcting entry.

---

## 6. LINT checklist

Run these checks and fix what you find. Lint **repairs**, it never **invents** — every fix must
be supported by existing `raw/` sources or the codebase; if a fix would require new knowledge,
stop and propose an INGEST instead.

1. **Broken links** — every `[[wikilink]]` resolves to a real page. Fix or remove dangling ones.
2. **Orphans** — every page is reachable from `index.md`. Link orphans in or delete them.
3. **Duplication** — no two pages explain the same thing. Merge into the canonical page and
   leave the other as a redirect-style stub that links to it (or delete and fix inbound links).
4. **Provenance** — flag `component`/`interface`/`decision` pages with empty `sources:`.
   Either add a source (including code-pointer sources) or set `status: unverified`.
5. **Staleness** — if a page references code that no longer matches (path moved, function
   renamed, decision reversed), mark `status: stale` and note it in `log.md`; fix if a source
   supports the new truth.
6. **Contradictions** — if two pages disagree, surface it. Resolve against `raw/`/code if
   possible; otherwise mark both `status: unverified` and add an "Open questions" note. **Never
   silently pick one.**
7. **Index accuracy** — `index.md` lists every current page, grouped by folder, with one-line
   descriptions, and lists nothing that no longer exists.
8. **Frontmatter validity** — every page has `title`, `type`, `status`, `updated`, and a
   (possibly empty, but then flagged) `sources:` list.
9. **Re-index** — run `qmd index wiki/ --db .qmd` if anything moved or was deleted.

Report a short summary of what lint changed, and log it.

---

## 7. Hard rules (do not violate)

- **Never modify or delete anything under `raw/`.** It is append-only ground truth.
- **Never assert what you haven't verified.** Mark it `unverified` instead. No confident
  hallucination.
- **Never create an orphan page or a duplicate page.** Search first; link, don't repeat.
- **Always update `index.md` and append to `log.md`** as part of finishing an INGEST.
- **Always re-index qmd** after changing the wiki's structure.
- **Cite your sources** in answers (by page path) and in pages (via `sources:` frontmatter).
- **When `raw/` and `wiki/` conflict, `raw/` is right** — fix the wiki, never the source.
- **Keep pages small and single-purpose.** Split before a page sprawls.
- **The human is the editor-in-chief.** If they correct a fact, treat their correction as a new
  source (capture it in `raw/sources/`), update the page, and log it.

---

## 8. Bootstrapping an empty repo

If `wiki/` is essentially empty when you're first run:

1. Create the folder skeleton from Section 1 and a `.gitignore` containing `.qmd/`.
2. Read the codebase (and any provided docs/READMEs) and INGEST a first pass: write
   `overview.md`, one `components/` page per top-level service/module, and `index.md`.
   Record what you read as code-pointer sources in `raw/sources/` (with the commit SHA).
3. Mark anything you inferred-but-couldn't-confirm as `status: unverified` and list it under
   "Open questions" so the human knows where to look.
4. Build the qmd index and write the first `log.md` entry.
5. Tell the human what you created, what you're unsure about, and what to ingest next.
