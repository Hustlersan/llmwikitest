import { spawn } from "node:child_process";
import { findRepoRoot } from "../lib/wiki.js";
import { c } from "../lib/term.js";

const QMD_PACKAGE = "@tobilu/qmd";

interface QmdContext {
  root: string;
  /** Use `npx <pkg>` instead of a globally installed `qmd` binary. */
  npx: boolean;
}

async function resolveRoot(start: string): Promise<string | null> {
  return findRepoRoot(start);
}

function buildCommand(ctx: QmdContext, args: string[]): { cmd: string; argv: string[] } {
  if (ctx.npx) {
    return { cmd: "npx", argv: ["--yes", QMD_PACKAGE, ...args] };
  }
  return { cmd: "qmd", argv: args };
}

function run(cmd: string, argv: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { cwd, stdio: "inherit" });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        console.error(c.red(`error: \`${cmd}\` is not installed or not on PATH.`));
        console.error(c.dim(`Install it with: npm install -g ${QMD_PACKAGE}`));
        console.error(c.dim("…or re-run this command with --npx to use it without installing."));
      } else {
        console.error(c.red(`error: failed to run ${cmd}: ${err.message}`));
      }
      resolve(127);
    });
    child.on("close", (code) => resolve(code ?? 0));
  });
}

export interface IndexOptions {
  root: string;
  npx: boolean;
}

/** Wrap `qmd index wiki/ --db .qmd` (CLAUDE.md §4). */
export async function runIndexCmd(opts: IndexOptions): Promise<number> {
  const root = await resolveRoot(opts.root);
  if (!root) {
    console.error(c.red(`error: no wiki repo found at or above ${opts.root}.`));
    return 2;
  }
  console.log(c.dim(`indexing wiki/ → .qmd  (in ${root})`));
  const { cmd, argv } = buildCommand({ root, npx: opts.npx }, ["index", "wiki/", "--db", ".qmd"]);
  return run(cmd, argv, root);
}

export interface SearchOptions {
  root: string;
  npx: boolean;
  query: string;
}

/** Wrap `qmd search "<query>" --db .qmd` (CLAUDE.md §4). */
export async function runSearchCmd(opts: SearchOptions): Promise<number> {
  const root = await resolveRoot(opts.root);
  if (!root) {
    console.error(c.red(`error: no wiki repo found at or above ${opts.root}.`));
    return 2;
  }
  if (!opts.query.trim()) {
    console.error(c.red("error: search requires a query string."));
    return 2;
  }
  const { cmd, argv } = buildCommand({ root, npx: opts.npx }, ["search", opts.query, "--db", ".qmd"]);
  return run(cmd, argv, root);
}
