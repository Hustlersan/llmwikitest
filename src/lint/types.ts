export type Severity = "error" | "warn" | "info";

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  /** Wiki-relative path of the page the finding concerns, if any. */
  page?: string;
  /** 1-based line number, if applicable. */
  line?: number;
}

export interface LintResult {
  findings: Finding[];
  errors: number;
  warnings: number;
  infos: number;
  pagesChecked: number;
}

/** The page `type` values allowed by the contract (CLAUDE.md §3). */
export const VALID_TYPES = ["component", "concept", "decision", "runbook", "interface"] as const;

/** The page `status` values allowed by the contract (CLAUDE.md §3). */
export const VALID_STATUSES = ["verified", "unverified", "stale", "superseded"] as const;

/** Page types whose empty `sources:` is a provenance smell (CLAUDE.md §6.4). */
export const SOURCED_TYPES = new Set(["component", "interface", "decision"]);
