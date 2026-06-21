# raw/ — immutable source material

**This folder is append-only ground truth. Never edit or delete anything in here.**

Every piece of source material that informs the wiki gets captured here *first*, before any
wiki page is written, so that every claim in `wiki/` is traceable to something concrete.

## What goes in `raw/sources/`
- Pasted notes, meeting transcripts, design docs, Slack threads, emails.
- Copies of READMEs or docs you ingested.
- **Code-pointer files** when the source is the codebase itself: a short markdown file recording
  exactly what was read — file paths plus the commit SHA — e.g.
  `2026-06-21-billing-module-at-a1b2c3d.md`.

## Naming
Use stable, descriptive, dated names: `YYYY-MM-DD-short-description.md`. Once a file is here,
its name and contents don't change. If the source was updated, add a *new* dated file rather
than editing the old one.

## Why this matters
If `raw/` and `wiki/` ever disagree, `raw/` is right and the wiki is wrong. The wiki is a
derived interpretation; this folder is the evidence.
