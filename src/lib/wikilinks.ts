/**
 * Wikilink extraction for the LLM Wiki pattern.
 *
 * The contract (CLAUDE.md §3/§4) uses `[[folder/page-name]]` links plus an
 * inline `[[source:...]]` form for citing raw provenance. We model both.
 */

export interface WikiLink {
  /** The full target as written, e.g. "components/api" or "source:raw/x.md". */
  target: string;
  /** Optional alias after a pipe: `[[target|alias]]`. */
  alias: string | null;
  /** True when the link is a `[[source:...]]` provenance reference. */
  isSource: boolean;
  /** For source links, the path after the `source:` prefix. */
  sourcePath: string | null;
  /** 1-based line number the link appears on. */
  line: number;
}

const LINK_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Replace inline-code spans on a single line with spaces, so that wikilinks
 * shown as illustrative syntax (e.g. `[[folder/page-name]]`) are not treated
 * as real links. Length is preserved so column-ish positions stay sensible.
 */
function blankInlineCode(line: string): string {
  let out = "";
  let inCode = false;
  for (const ch of line) {
    if (ch === "`") {
      inCode = !inCode;
      out += " ";
    } else {
      out += inCode ? " " : ch;
    }
  }
  return out;
}

/**
 * Extract every `[[...]]` wikilink from markdown text, ignoring links that are
 * illustrative rather than real: those inside fenced code blocks (```),
 * HTML comments (<!-- ... -->, possibly multi-line), or inline-code spans.
 */
export function extractWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  let inComment = false;

  lines.forEach((rawLine, idx) => {
    const fence = rawLine.match(/^[ \t]*(```|~~~)/);
    if (fence) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    // Strip HTML comment regions, carrying open state across lines.
    let line = "";
    let i = 0;
    while (i < rawLine.length) {
      if (inComment) {
        const close = rawLine.indexOf("-->", i);
        if (close === -1) {
          i = rawLine.length;
        } else {
          inComment = false;
          i = close + 3;
        }
      } else {
        const open = rawLine.indexOf("<!--", i);
        if (open === -1) {
          line += rawLine.slice(i);
          i = rawLine.length;
        } else {
          line += rawLine.slice(i, open);
          inComment = true;
          i = open + 4;
        }
      }
    }

    line = blankInlineCode(line);

    let m: RegExpExecArray | null;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(line)) !== null) {
      const inner = m[1].trim();
      if (inner === "") continue;
      const pipe = inner.indexOf("|");
      const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
      const alias = pipe === -1 ? null : inner.slice(pipe + 1).trim();
      const isSource = /^source:/i.test(target);
      links.push({
        target,
        alias: alias || null,
        isSource,
        sourcePath: isSource ? target.replace(/^source:/i, "").trim() : null,
        line: idx + 1,
      });
    }
  });

  return links;
}

/**
 * Normalise a (non-source) wikilink target to a wiki-relative page key without
 * extension, e.g. "components/api.md" -> "components/api", "overview" stays.
 */
export function targetToPageKey(target: string): string {
  let t = target.trim();
  t = t.replace(/\\/g, "/");
  t = t.replace(/\.md$/i, "");
  // Drop any leading "./" or "wiki/" the author may have included.
  t = t.replace(/^\.\//, "").replace(/^wiki\//, "");
  return t;
}
