import { promises as fs } from "node:fs";
import * as path from "node:path";
import { templatesDir } from "../lib/paths.js";
import { c } from "../lib/term.js";

export interface InitOptions {
  /** Target directory to scaffold into (default "."). */
  dir: string;
  /** Overwrite files that already exist. */
  force: boolean;
  /** Print what would happen without writing. */
  dryRun: boolean;
}

interface CopyEntry {
  from: string;
  to: string;
}

/** Files whose template name differs from the on-disk name. */
function mapName(relPath: string): string {
  // npm strips a top-level .gitignore from published packages, so we ship it as
  // `gitignore` and restore the dot on scaffold.
  if (relPath === "gitignore") return ".gitignore";
  return relPath;
}

async function collect(srcRoot: string, dstRoot: string): Promise<CopyEntry[]> {
  const entries: CopyEntry[] = [];
  const walk = async (rel: string) => {
    const abs = path.join(srcRoot, rel);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      for (const name of await fs.readdir(abs)) {
        await walk(rel ? path.join(rel, name) : name);
      }
    } else {
      const mapped = mapName(rel.split(path.sep).join("/"));
      entries.push({ from: abs, to: path.join(dstRoot, mapped) });
    }
  };
  await walk("");
  return entries;
}

export async function runInit(opts: InitOptions): Promise<number> {
  const src = templatesDir();
  try {
    await fs.access(src);
  } catch {
    console.error(c.red(`error: bundled templates not found at ${src}. Did the build run?`));
    return 1;
  }

  const dst = path.resolve(opts.dir);
  const entries = await collect(src, dst);

  let created = 0;
  let skipped = 0;
  for (const { from, to } of entries) {
    const rel = path.relative(dst, to) || path.basename(to);
    let alreadyThere = false;
    try {
      await fs.access(to);
      alreadyThere = true;
    } catch {
      alreadyThere = false;
    }

    if (alreadyThere && !opts.force) {
      skipped++;
      console.log(`  ${c.yellow("skip")}   ${rel} ${c.dim("(exists)")}`);
      continue;
    }

    if (opts.dryRun) {
      console.log(`  ${c.green("create")} ${rel} ${c.dim("(dry-run)")}`);
      created++;
      continue;
    }

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
    console.log(`  ${c.green(alreadyThere ? "overwrite" : "create")} ${rel}`);
    created++;
  }

  console.log("");
  console.log(
    `${c.bold("Scaffold complete.")} ${created} file(s) ${opts.dryRun ? "would be " : ""}written, ${skipped} skipped.`,
  );
  if (skipped > 0 && !opts.force) {
    console.log(c.dim("Re-run with --force to overwrite existing files."));
  }
  console.log("");
  console.log("Next steps:");
  console.log(`  1. ${c.bold("Read CLAUDE.md")} — it is the schema and the rulebook.`);
  console.log("  2. Drop your first source into raw/sources/, then ingest it into wiki/.");
  console.log(`  3. Run ${c.bold("llmwiki lint")} to check the wiki against the contract.`);
  console.log(`  4. Run ${c.bold("llmwiki index")} to build the qmd search index.`);
  return 0;
}
