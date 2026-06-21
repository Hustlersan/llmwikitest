import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWikiLinks, targetToPageKey } from "../src/lib/wikilinks.js";

test("extracts plain links with line numbers", () => {
  const links = extractWikiLinks("intro\nsee [[components/api]] and [[overview]]\n");
  assert.equal(links.length, 2);
  assert.equal(links[0].target, "components/api");
  assert.equal(links[0].line, 2);
  assert.equal(links[1].target, "overview");
});

test("parses aliases and source links", () => {
  const links = extractWikiLinks("[[components/api|the API]] and [[source:raw/sources/x.md]]");
  assert.equal(links[0].target, "components/api");
  assert.equal(links[0].alias, "the API");
  assert.equal(links[1].isSource, true);
  assert.equal(links[1].sourcePath, "raw/sources/x.md");
});

test("ignores links inside fenced code blocks", () => {
  const md = ["before [[a/real]]", "```", "[[fake/one]]", "```", "after [[b/real]]"].join("\n");
  const targets = extractWikiLinks(md).map((l) => l.target);
  assert.deepEqual(targets, ["a/real", "b/real"]);
});

test("ignores links inside HTML comments, including multi-line", () => {
  const md = [
    "real [[keep/me]]",
    "<!-- - [[drop/me]] — example -->",
    "<!-- multi",
    "line [[also/drop]] -->",
    "tail [[keep/two]]",
  ].join("\n");
  const targets = extractWikiLinks(md).map((l) => l.target);
  assert.deepEqual(targets, ["keep/me", "keep/two"]);
});

test("ignores links inside inline code spans", () => {
  const targets = extractWikiLinks("use `[[folder/page-name]]` syntax, e.g. [[real/page]]").map((l) => l.target);
  assert.deepEqual(targets, ["real/page"]);
});

test("targetToPageKey normalises extensions and prefixes", () => {
  assert.equal(targetToPageKey("components/api.md"), "components/api");
  assert.equal(targetToPageKey("wiki/overview"), "overview");
  assert.equal(targetToPageKey("./concepts/x"), "concepts/x");
});
