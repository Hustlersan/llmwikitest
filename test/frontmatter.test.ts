import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument, asList, asScalar } from "../src/lib/frontmatter.js";

test("parses scalars, block lists, and the body", () => {
  const doc = parseDocument(
    [
      "---",
      "title: Billing Service",
      "type: component",
      "status: verified",
      "sources:",
      "  - raw/sources/a.md",
      "  - raw/sources/b.md",
      "updated: 2026-06-21",
      "---",
      "",
      "# Billing",
      "body text",
    ].join("\n"),
  );
  assert.equal(doc.hasFrontmatter, true);
  assert.equal(asScalar(doc.data.title), "Billing Service");
  assert.equal(asScalar(doc.data.type), "component");
  assert.deepEqual(doc.data.sources, ["raw/sources/a.md", "raw/sources/b.md"]);
  assert.match(doc.body, /# Billing/);
});

test("treats an empty key and inline [] as empty lists", () => {
  const doc = parseDocument(["---", "sources:", "related: []", "title: X", "---", "body"].join("\n"));
  assert.deepEqual(asList(doc.data.sources), []);
  assert.deepEqual(asList(doc.data.related), []);
  assert.deepEqual(asList(doc.data.title), ["X"]);
});

test("strips inline comments and quotes", () => {
  const doc = parseDocument(
    ["---", "type: component            # the kind", 'title: "Quoted Title"', "---", ""].join("\n"),
  );
  assert.equal(asScalar(doc.data.type), "component");
  assert.equal(asScalar(doc.data.title), "Quoted Title");
});

test("keeps a hash inside quotes", () => {
  const doc = parseDocument(['---', 'title: "C# notes"', "---", ""].join("\n"));
  assert.equal(asScalar(doc.data.title), "C# notes");
});

test("reports missing frontmatter", () => {
  const doc = parseDocument("# Just a heading\n\nno frontmatter here");
  assert.equal(doc.hasFrontmatter, false);
  assert.deepEqual(doc.data, {});
});

test("handles an unterminated fence without throwing", () => {
  const doc = parseDocument("---\ntitle: X\nno closing fence");
  assert.equal(doc.hasFrontmatter, true);
  assert.deepEqual(doc.data, {});
});
