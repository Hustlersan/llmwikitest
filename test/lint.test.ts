import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadWiki } from "../src/lib/wiki.js";
import { lintWiki } from "../src/lint/rules.js";
import type { Finding } from "../src/lint/types.js";

async function makeRepo(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "llmwiki-test-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return root;
}

function rules(findings: Finding[]): string[] {
  return findings.map((f) => f.rule).sort();
}

const cleanIndex = [
  "---",
  "title: Index",
  "type: concept",
  "status: verified",
  "sources: []",
  "updated: 2026-06-21",
  "---",
  "# Index",
  "- [[components/api]] — the API.",
].join("\n");

test("a well-formed wiki passes with no errors", async () => {
  const root = await makeRepo({
    "wiki/index.md": cleanIndex,
    "raw/sources/api.md": "source",
    "wiki/components/api.md": [
      "---",
      "title: API",
      "type: component",
      "status: verified",
      "sources:",
      "  - raw/sources/api.md",
      "updated: 2026-06-21",
      "---",
      "# API",
      "Cited [[source:raw/sources/api.md]].",
    ].join("\n"),
  });
  const result = await lintWiki(await loadWiki(root));
  assert.equal(result.errors, 0, JSON.stringify(result.findings, null, 2));
  assert.equal(result.warnings, 0);
  await fs.rm(root, { recursive: true, force: true });
});

test("flags broken links, bad frontmatter, and orphans as errors", async () => {
  const root = await makeRepo({
    "wiki/index.md": cleanIndex,
    "wiki/components/api.md": [
      "---",
      "title: API",
      "type: component",
      "status: verified",
      "sources: []", // empty -> provenance warn
      "updated: 2026-06-21",
      "---",
      "# API",
      "Link to [[interfaces/ghost]].", // broken-link error
    ].join("\n"),
    "wiki/concepts/orphan.md": [
      "---",
      "title: Orphan",
      "type: wrongtype", // invalid type error
      "status: verified",
      "sources: []",
      // missing updated -> frontmatter error
      "---",
      "# Orphan",
    ].join("\n"),
  });
  const result = await lintWiki(await loadWiki(root));
  const found = rules(result.findings);
  assert.ok(found.includes("broken-link"));
  assert.ok(found.includes("orphan"));
  assert.ok(found.includes("frontmatter"));
  assert.ok(found.includes("provenance"));
  assert.ok(result.errors >= 3);
  await fs.rm(root, { recursive: true, force: true });
});

test("warns on reachable-but-unlisted pages and missing source files", async () => {
  const root = await makeRepo({
    "wiki/index.md": cleanIndex,
    "wiki/components/api.md": [
      "---",
      "title: API",
      "type: component",
      "status: verified",
      "sources:",
      "  - raw/sources/api.md",
      "updated: 2026-06-21",
      "---",
      "# API",
      "Links to [[components/worker]].",
      "Cites [[source:raw/sources/missing.md]].",
    ].join("\n"),
    "raw/sources/api.md": "x",
    "wiki/components/worker.md": [
      "---",
      "title: Worker",
      "type: component",
      "status: unverified",
      "sources: []",
      "updated: 2026-06-21",
      "---",
      "# Worker",
    ].join("\n"),
  });
  const result = await lintWiki(await loadWiki(root));
  const found = rules(result.findings);
  assert.equal(result.errors, 0, JSON.stringify(result.findings, null, 2));
  assert.ok(found.includes("index-coverage"), "worker reachable via api but not listed");
  assert.ok(found.includes("source-link"), "missing.md does not exist");
  await fs.rm(root, { recursive: true, force: true });
});

test("flags duplicate titles", async () => {
  const root = await makeRepo({
    "wiki/index.md": [cleanIndex, "- [[components/dup]] — dup."].join("\n"),
    "raw/sources/api.md": "x",
    "wiki/components/api.md": [
      "---", "title: Same Title", "type: component", "status: verified",
      "sources:", "  - raw/sources/api.md", "updated: 2026-06-21", "---", "# A",
    ].join("\n"),
    "wiki/components/dup.md": [
      "---", "title: Same Title", "type: component", "status: unverified",
      "sources: []", "updated: 2026-06-21", "---", "# B",
    ].join("\n"),
  });
  const result = await lintWiki(await loadWiki(root));
  assert.ok(rules(result.findings).includes("duplicate-title"));
  await fs.rm(root, { recursive: true, force: true });
});
