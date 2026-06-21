#!/usr/bin/env node
import { runInit } from "./commands/init.js";
import { runLint } from "./commands/lint.js";
import { runIndexCmd, runSearchCmd } from "./commands/qmd.js";
import { c } from "./lib/term.js";

const VERSION = "0.1.0";

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/** Parse argv into positionals and flags. Supports --flag, --flag=val, --flag val. */
function parseArgs(argv: string[], valueFlags: Set<string>): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
      const eq = body.indexOf("=");
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (valueFlags.has(body) && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        flags[body] = argv[++i];
      } else {
        flags[body] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function str(flags: Record<string, string | boolean>, key: string, fallback: string): string {
  const v = flags[key];
  return typeof v === "string" ? v : fallback;
}

const HELP = `${c.bold("llmwiki")} — tooling for the LLM Wiki pattern (see CLAUDE.md)

${c.bold("Usage:")} llmwiki <command> [options]

${c.bold("Commands:")}
  init [dir]        Scaffold a new wiki repo (raw/, wiki/, CLAUDE.md, .gitignore)
                    into dir (default: current directory).
      --force         Overwrite files that already exist.
      --dry-run       Show what would be written without writing.

  lint              Check the wiki against the CLAUDE.md §6 contract:
                    frontmatter validity, broken wikilinks, orphans, index
                    coverage, provenance and duplicate titles.
      --root <dir>    Repo root to lint (default: search upward from cwd).
      --strict        Exit non-zero on warnings, not just errors.
      --json          Emit findings as JSON.

  index             Build/refresh the qmd search index (qmd index wiki/ --db .qmd).
      --root <dir>    Repo root (default: search upward from cwd).
      --npx           Run qmd via npx instead of a global install.

  search <query>    Search the wiki via qmd (qmd search "<query>" --db .qmd).
      --root <dir>    Repo root (default: search upward from cwd).
      --npx           Run qmd via npx instead of a global install.

  help              Show this help.
  version           Print the version.

${c.dim("Exit codes: 0 ok · 1 lint errors (or warnings under --strict) · 2 usage/setup")}
`;

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return 0;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return 0;
  }

  const valueFlags = new Set(["root"]);
  const { positionals, flags } = parseArgs(rest, valueFlags);

  switch (command) {
    case "init":
      return runInit({
        dir: positionals[0] ?? ".",
        force: flags.force === true,
        dryRun: flags["dry-run"] === true,
      });

    case "lint":
      return runLint({
        root: str(flags, "root", process.cwd()),
        json: flags.json === true,
        strict: flags.strict === true,
      });

    case "index":
    case "reindex":
      return runIndexCmd({
        root: str(flags, "root", process.cwd()),
        npx: flags.npx === true,
      });

    case "search":
      return runSearchCmd({
        root: str(flags, "root", process.cwd()),
        npx: flags.npx === true,
        query: positionals.join(" "),
      });

    default:
      console.error(c.red(`unknown command: ${command}`));
      console.error(c.dim("Run `llmwiki help` for usage."));
      return 2;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(c.red(`fatal: ${err instanceof Error ? err.message : String(err)}`));
    process.exitCode = 1;
  });
