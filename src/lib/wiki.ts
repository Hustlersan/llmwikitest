import { promises as fs } from "node:fs";
import * as path from "node:path";
import { parseDocument, type Frontmatter, asList, asScalar } from "./frontmatter.js";
import { extractWikiLinks, type WikiLink } from "./wikilinks.js";

export interface WikiPage {
  /** Absolute path on disk. */
  absPath: string;
  /** Path relative to the wiki/ dir, posix-separated, e.g. "components/api.md". */
  relPath: string;
  /** Page key without extension, e.g. "components/api" or "index". */
  key: string;
  data: Frontmatter;
  body: string;
  hasFrontmatter: boolean;
  links: WikiLink[];
}

export interface WikiRepo {
  /** Repo root (directory containing wiki/, and usually raw/ and CLAUDE.md). */
  root: string;
  wikiDir: string;
  rawDir: string;
  pages: WikiPage[];
}

const SPECIAL_KEYS = new Set(["index", "log"]);

/** Pages that are infrastructure, exempt from the orphan/index-listing rules. */
export function isSpecialPage(page: WikiPage): boolean {
  return SPECIAL_KEYS.has(page.key);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate the wiki repo root, starting at `start` and walking up. A directory
 * qualifies if it contains a `wiki/` folder (preferred) or a CLAUDE.md.
 */
export async function findRepoRoot(start: string): Promise<string | null> {
  let dir = path.resolve(start);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await exists(path.join(dir, "wiki", "index.md"))) return dir;
    if ((await exists(path.join(dir, "wiki"))) && (await exists(path.join(dir, "CLAUDE.md")))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(full)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function toKey(relPath: string): string {
  return relPath.replace(/\.md$/i, "");
}

/** Load every wiki page under `root/wiki`. */
export async function loadWiki(root: string): Promise<WikiRepo> {
  const wikiDir = path.join(root, "wiki");
  const rawDir = path.join(root, "raw");
  const files = (await walkMarkdown(wikiDir)).sort();
  const pages: WikiPage[] = [];

  for (const absPath of files) {
    const content = await fs.readFile(absPath, "utf8");
    const parsed = parseDocument(content);
    const relPath = path.relative(wikiDir, absPath).split(path.sep).join("/");
    pages.push({
      absPath,
      relPath,
      key: toKey(relPath),
      data: parsed.data,
      body: parsed.body,
      hasFrontmatter: parsed.hasFrontmatter,
      links: extractWikiLinks(content),
    });
  }

  return { root, wikiDir, rawDir, pages };
}

/** Convenience accessors over a page's frontmatter. */
export const field = {
  title: (p: WikiPage) => asScalar(p.data.title),
  type: (p: WikiPage) => asScalar(p.data.type),
  status: (p: WikiPage) => asScalar(p.data.status),
  updated: (p: WikiPage) => asScalar(p.data.updated),
  sources: (p: WikiPage) => asList(p.data.sources),
};
