import * as path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the bundled starter templates (package-root /templates). */
export function templatesDir(): string {
  // Compiled file lives at dist/lib/paths.js -> repo root is two levels up.
  return path.resolve(here, "..", "..", "templates");
}
