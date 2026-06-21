/**
 * Minimal YAML-frontmatter parser tailored to the LLM Wiki page contract
 * (CLAUDE.md §3). It deliberately supports only the small YAML subset the
 * contract uses — scalars and block/inline sequences of scalars — rather than
 * pulling in a full YAML dependency.
 *
 * Supported shapes:
 *
 *   title: Billing Service          # scalar
 *   status: verified
 *   sources:                        # block sequence
 *     - raw/sources/a.md
 *     - raw/sources/b.md
 *   related: []                     # empty inline sequence
 *   sources:                        # key with no value and no items -> []
 */

export type FrontmatterValue = string | string[];
export type Frontmatter = Record<string, FrontmatterValue>;

export interface ParsedDocument {
  /** Raw frontmatter block text (between the `---` fences), or null if absent. */
  raw: string | null;
  /** Parsed key/value pairs. Empty object when no frontmatter is present. */
  data: Frontmatter;
  /** The markdown body that follows the frontmatter. */
  body: string;
  /** True when the document opened with a `---` fence at all. */
  hasFrontmatter: boolean;
}

const FENCE = /^---[ \t]*$/;

/** Strip a trailing inline `# comment` and surrounding whitespace/quotes. */
function cleanScalar(input: string): string {
  let s = input.trim();
  // Remove an inline comment that is not inside quotes. The contract only uses
  // simple values, so a space-preceded `#` is treated as a comment start.
  const hashAt = findCommentStart(s);
  if (hashAt !== -1) s = s.slice(0, hashAt).trim();
  return unquote(s);
}

function findCommentStart(s: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble && (i === 0 || s[i - 1] === " " || s[i - 1] === "\t")) {
      return i;
    }
  }
  return -1;
}

function unquote(s: string): string {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

/** Split a document into its frontmatter block and body. */
export function parseDocument(content: string): ParsedDocument {
  // Normalise line endings so the parser behaves the same on CRLF files.
  const normalised = content.replace(/\r\n/g, "\n");
  const lines = normalised.split("\n");

  if (lines.length === 0 || !FENCE.test(lines[0])) {
    return { raw: null, data: {}, body: content, hasFrontmatter: false };
  }

  // Find the closing fence.
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    // Opened a fence but never closed it — treat as malformed frontmatter.
    return { raw: null, data: {}, body: content, hasFrontmatter: true };
  }

  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n");
  return {
    raw: fmLines.join("\n"),
    data: parseFrontmatterBlock(fmLines),
    body,
    hasFrontmatter: true,
  };
}

function parseFrontmatterBlock(lines: string[]): Frontmatter {
  const data: Frontmatter = {};
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  const flush = () => {
    if (currentKey !== null) {
      // A key that opened a block but collected no items is an empty list.
      data[currentKey] = currentList ?? "";
    }
    currentKey = null;
    currentList = null;
  };

  for (const rawLine of lines) {
    if (rawLine.trim() === "") continue;

    const listMatch = rawLine.match(/^[ \t]+-[ \t]*(.*)$/);
    if (listMatch && currentKey !== null) {
      if (currentList === null) currentList = [];
      const item = cleanScalar(listMatch[1]);
      if (item !== "") currentList.push(item);
      continue;
    }

    const kvMatch = rawLine.match(/^([A-Za-z0-9_-]+):[ \t]*(.*)$/);
    if (kvMatch) {
      flush();
      const key = kvMatch[1];
      const value = kvMatch[2];
      if (value === "" ) {
        // Begin a (possibly empty) block sequence.
        currentKey = key;
        currentList = null;
      } else if (value.trim() === "[]") {
        data[key] = [];
      } else {
        data[key] = cleanScalar(value);
      }
      continue;
    }
    // Unrecognised line: ignore (keeps the parser forgiving).
  }
  flush();
  return data;
}

/** Coerce a frontmatter value to an array (scalars become single-item arrays). */
export function asList(value: FrontmatterValue | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (value.trim() === "") return [];
  return [value];
}

/** Coerce a frontmatter value to a scalar string ("" when missing/list). */
export function asScalar(value: FrontmatterValue | undefined): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return "";
  return value;
}
