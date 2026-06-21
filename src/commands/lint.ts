import { findRepoRoot, loadWiki } from "../lib/wiki.js";
import { lintWiki } from "../lint/rules.js";
import type { Finding } from "../lint/types.js";
import { c } from "../lib/term.js";

export interface LintOptions {
  root: string;
  json: boolean;
  /** Treat warnings as failures (non-zero exit). */
  strict: boolean;
}

function sevLabel(f: Finding): string {
  if (f.severity === "error") return c.red("error");
  if (f.severity === "warn") return c.yellow("warn ");
  return c.blue("info ");
}

function location(f: Finding): string {
  if (!f.page) return c.dim("(wiki)");
  return c.dim(`wiki/${f.page}${f.line ? `:${f.line}` : ""}`);
}

export async function runLint(opts: LintOptions): Promise<number> {
  const root = await findRepoRoot(opts.root);
  if (!root) {
    console.error(c.red(`error: could not find a wiki repo at or above ${opts.root} (looking for wiki/index.md or CLAUDE.md).`));
    console.error(c.dim("Run `llmwiki init` to scaffold one, or pass --root <dir>."));
    return 2;
  }

  const repo = await loadWiki(root);
  const result = await lintWiki(repo);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const f of result.findings) {
      console.log(`${sevLabel(f)} ${c.bold(f.rule.padEnd(15))} ${location(f)}  ${f.message}`);
    }
    console.log("");
    const parts = [
      `${result.pagesChecked} page(s) checked`,
      result.errors ? c.red(`${result.errors} error(s)`) : c.green("0 errors"),
      result.warnings ? c.yellow(`${result.warnings} warning(s)`) : `${result.warnings} warnings`,
      `${result.infos} info`,
    ];
    console.log(parts.join(c.dim(" · ")));
    if (result.errors === 0 && (result.warnings === 0 || !opts.strict)) {
      console.log(c.green("✓ wiki passes lint."));
    }
  }

  if (result.errors > 0) return 1;
  if (opts.strict && result.warnings > 0) return 1;
  return 0;
}
