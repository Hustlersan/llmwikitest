import { promises as fs } from "node:fs";
import * as path from "node:path";
import {
  type WikiRepo,
  type WikiPage,
  field,
  isSpecialPage,
} from "../lib/wiki.js";
import { targetToPageKey } from "../lib/wikilinks.js";
import {
  type Finding,
  type LintResult,
  VALID_TYPES,
  VALID_STATUSES,
  SOURCED_TYPES,
} from "./types.js";

/**
 * Run the full lint checklist (CLAUDE.md §6) over an already-loaded wiki.
 * Each rule is mechanical: it only inspects structure, links, frontmatter and
 * provenance. It never invents knowledge.
 */
export async function lintWiki(repo: WikiRepo): Promise<LintResult> {
  const findings: Finding[] = [];
  const byKey = new Map<string, WikiPage>();
  for (const p of repo.pages) byKey.set(p.key, p);

  findings.push(...checkFrontmatter(repo));
  findings.push(...checkBrokenLinks(repo, byKey));
  findings.push(...await checkSourceLinks(repo));
  findings.push(...checkReachabilityAndIndex(repo, byKey));
  findings.push(...checkProvenance(repo));
  findings.push(...checkDuplicateTitles(repo));
  findings.push(...reportStatus(repo));

  return tally(findings, repo.pages.length);
}

/** §6.8 — every page has title, type, status, updated and a sources key. */
function checkFrontmatter(repo: WikiRepo): Finding[] {
  const out: Finding[] = [];
  for (const p of repo.pages) {
    if (!p.hasFrontmatter) {
      out.push({ rule: "frontmatter", severity: "error", page: p.relPath, message: "missing YAML frontmatter block" });
      continue;
    }
    for (const key of ["title", "type", "status", "updated"]) {
      if (!(key in p.data) || field[key as "title"](p) === "") {
        out.push({ rule: "frontmatter", severity: "error", page: p.relPath, message: `missing or empty required field: ${key}` });
      }
    }
    if (!("sources" in p.data)) {
      out.push({ rule: "frontmatter", severity: "warn", page: p.relPath, message: "missing `sources:` key (use an empty list if there are none)" });
    }
    const type = field.type(p);
    if (type && !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      out.push({ rule: "frontmatter", severity: "error", page: p.relPath, message: `invalid type "${type}" (expected one of: ${VALID_TYPES.join(", ")})` });
    }
    const status = field.status(p);
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      out.push({ rule: "frontmatter", severity: "error", page: p.relPath, message: `invalid status "${status}" (expected one of: ${VALID_STATUSES.join(", ")})` });
    }
  }
  return out;
}

/** §6.1 — every `[[wikilink]]` resolves to a real page. */
function checkBrokenLinks(repo: WikiRepo, byKey: Map<string, WikiPage>): Finding[] {
  const out: Finding[] = [];
  for (const p of repo.pages) {
    for (const link of p.links) {
      if (link.isSource) continue; // handled by checkSourceLinks
      const key = targetToPageKey(link.target);
      if (!byKey.has(key)) {
        out.push({
          rule: "broken-link",
          severity: "error",
          page: p.relPath,
          line: link.line,
          message: `wikilink [[${link.target}]] does not resolve to a page (wiki/${key}.md)`,
        });
      }
    }
  }
  return out;
}

/** §3 — inline `[[source:...]]` references should point at a real raw/ file. */
async function checkSourceLinks(repo: WikiRepo): Promise<Finding[]> {
  const out: Finding[] = [];
  const cache = new Map<string, boolean>();
  const present = async (rel: string): Promise<boolean> => {
    if (cache.has(rel)) return cache.get(rel)!;
    const abs = path.resolve(repo.root, rel);
    let ok = false;
    try {
      await fs.access(abs);
      ok = true;
    } catch {
      ok = false;
    }
    cache.set(rel, ok);
    return ok;
  };

  for (const p of repo.pages) {
    for (const link of p.links) {
      if (!link.isSource || !link.sourcePath) continue;
      if (!(await present(link.sourcePath))) {
        out.push({
          rule: "source-link",
          severity: "warn",
          page: p.relPath,
          line: link.line,
          message: `[[source:${link.sourcePath}]] points at a file that does not exist`,
        });
      }
    }
  }
  return out;
}

/**
 * §6.2 + §6.7 — reachability from index.md and direct index listing.
 * Orphans (unreachable) are errors; reachable-but-not-listed pages are warnings.
 */
function checkReachabilityAndIndex(repo: WikiRepo, byKey: Map<string, WikiPage>): Finding[] {
  const out: Finding[] = [];
  const index = byKey.get("index");
  if (!index) {
    out.push({ rule: "index", severity: "error", message: "wiki/index.md is missing — the catalog root does not exist" });
    return out;
  }

  // Direct links from index.md (the catalog).
  const listedInIndex = new Set<string>();
  for (const link of index.links) {
    if (link.isSource) continue;
    listedInIndex.add(targetToPageKey(link.target));
  }

  // Reachability via BFS over the full wikilink graph, rooted at index.
  const reachable = new Set<string>(["index"]);
  const queue: string[] = ["index"];
  while (queue.length) {
    const cur = byKey.get(queue.shift()!);
    if (!cur) continue;
    for (const link of cur.links) {
      if (link.isSource) continue;
      const key = targetToPageKey(link.target);
      if (byKey.has(key) && !reachable.has(key)) {
        reachable.add(key);
        queue.push(key);
      }
    }
  }

  for (const p of repo.pages) {
    if (isSpecialPage(p)) continue; // index/log are infrastructure roots
    if (!reachable.has(p.key)) {
      out.push({ rule: "orphan", severity: "error", page: p.relPath, message: "orphan page: not reachable from index.md via any wikilink" });
    } else if (!listedInIndex.has(p.key)) {
      out.push({ rule: "index-coverage", severity: "warn", page: p.relPath, message: "reachable but not listed directly in index.md (§6.7 wants every page catalogued)" });
    }
  }
  return out;
}

/** §6.4 — component/interface/decision pages need provenance unless unverified. */
function checkProvenance(repo: WikiRepo): Finding[] {
  const out: Finding[] = [];
  for (const p of repo.pages) {
    const type = field.type(p);
    if (!SOURCED_TYPES.has(type)) continue;
    const sources = field.sources(p);
    const status = field.status(p);
    if (sources.length === 0 && status !== "unverified") {
      out.push({
        rule: "provenance",
        severity: "warn",
        page: p.relPath,
        message: `${type} page has empty sources: — add a source (or a code-pointer source) or set status: unverified`,
      });
    }
  }
  return out;
}

/** §6.3 (light) — flag pages that share a title, a cheap duplication signal. */
function checkDuplicateTitles(repo: WikiRepo): Finding[] {
  const out: Finding[] = [];
  const seen = new Map<string, string[]>();
  for (const p of repo.pages) {
    if (isSpecialPage(p)) continue;
    const t = field.title(p).trim().toLowerCase();
    if (!t) continue;
    const arr = seen.get(t) ?? [];
    arr.push(p.relPath);
    seen.set(t, arr);
  }
  for (const [title, paths] of seen) {
    if (paths.length > 1) {
      out.push({ rule: "duplicate-title", severity: "warn", message: `${paths.length} pages share the title "${title}": ${paths.join(", ")} — possible duplication (§6.3)` });
    }
  }
  return out;
}

/** §6.5 (informational) — surface pages already marked stale/superseded. */
function reportStatus(repo: WikiRepo): Finding[] {
  const out: Finding[] = [];
  for (const p of repo.pages) {
    const status = field.status(p);
    if (status === "stale" || status === "superseded") {
      out.push({ rule: "status", severity: "info", page: p.relPath, message: `status: ${status}` });
    }
  }
  return out;
}

function tally(findings: Finding[], pagesChecked: number): LintResult {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const f of findings) {
    if (f.severity === "error") errors++;
    else if (f.severity === "warn") warnings++;
    else infos++;
  }
  // Stable ordering: by severity, then page, then rule.
  const sevRank = { error: 0, warn: 1, info: 2 } as const;
  findings.sort((a, b) =>
    sevRank[a.severity] - sevRank[b.severity] ||
    (a.page ?? "").localeCompare(b.page ?? "") ||
    a.rule.localeCompare(b.rule) ||
    (a.line ?? 0) - (b.line ?? 0));
  return { findings, errors, warnings, infos, pagesChecked };
}
