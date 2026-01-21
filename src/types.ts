/**
 * Type definitions for branch-narrator outputs.
 * These are minimal interfaces covering what the action needs.
 */

// ============================================================================
// Risk Report Types
// ============================================================================

export type RiskReportLevel = "low" | "moderate" | "elevated" | "high" | "critical";

export type RiskCategory =
  | "security"
  | "ci"
  | "deps"
  | "db"
  | "infra"
  | "api"
  | "tests"
  | "churn";

export interface RiskFlagEvidence {
  file: string;
  hunk?: string;
  lines: string[];
}

export interface RiskFlag {
  /** Stable rule identifier, e.g. "db.destructive_sql" */
  ruleKey: string;
  /** Stable instance ID */
  flagId: string;
  /** Links to findings that triggered this flag */
  relatedFindingIds: string[];
  category: RiskCategory;
  score: number;
  confidence: number;
  title: string;
  summary: string;
  evidence: RiskFlagEvidence[];
  suggestedChecks: string[];
  tags?: string[];
  effectiveScore: number;
}

export interface RiskReport {
  schemaVersion: string;
  generatedAt?: string;
  range: {
    base: string;
    head: string;
    mode?: string;
  };
  riskScore: number;
  riskLevel: RiskReportLevel;
  categoryScores: Record<RiskCategory, number>;
  flags: RiskFlag[];
  skippedFiles: Array<{ file: string; reason: string }>;
  scoreBreakdown?: {
    maxCategory: { category: RiskCategory; score: number };
    topCategories: Array<{ category: RiskCategory; score: number }>;
    formula: string;
  };
  filters?: {
    only?: string[];
    exclude?: string[];
  };
}

// ============================================================================
// Facts Output Types
// ============================================================================

export type RiskLevel = "high" | "medium" | "low";

export interface RiskScore {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
  evidenceBullets?: string[];
}

export interface RiskFactor {
  kind: string;
  weight: number;
  explanation: string;
  evidence: Evidence[];
}

export interface Evidence {
  file: string;
  excerpt: string;
  line?: number;
  hunk?: {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
  };
}

export type ActionCategory =
  | "tests"
  | "types"
  | "database"
  | "environment"
  | "dependencies"
  | "cloudflare"
  | "documentation";

export interface Action {
  /** Unique identifier for the action */
  id: string;
  /** Category for grouping related actions */
  category: ActionCategory;
  /** Whether this action blocks PR merge */
  blocking: boolean;
  /** Human-readable explanation */
  reason: string;
  /** Context about what triggered this action */
  triggers: string[];
}

export interface GitInfo {
  base: string;
  head: string;
  range: string;
  repoRoot: string;
  isDirty: boolean;
  mode?: string;
}

export interface ProfileInfo {
  requested: string;
  detected: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

export interface Stats {
  filesChanged: number;
  insertions: number;
  deletions: number;
  skippedFilesCount: number;
}

export interface Summary {
  byArea: Record<string, number>;
  highlights: string[];
}

export type FileCategory =
  | "product"
  | "tests"
  | "ci"
  | "infra"
  | "database"
  | "docs"
  | "dependencies"
  | "config"
  | "artifacts"
  | "other";

export interface ChangesetInfo {
  files: {
    added: string[];
    modified: string[];
    deleted: string[];
    renamed: Array<{ from: string; to: string }>;
  };
  byCategory: Record<FileCategory, string[]>;
  categorySummary: Array<{ category: FileCategory; count: number }>;
  changeDescriptions?: Array<{ file: string; description: string }>;
  warnings: Array<
    | { type: "large-diff"; filesChanged: number; linesChanged: number }
    | { type: "lockfile-mismatch"; manifestChanged: boolean; lockfileChanged: boolean }
  >;
}

export interface Finding {
  type: string;
  kind: string;
  category: string;
  confidence: "high" | "medium" | "low";
  evidence: Evidence[];
  findingId?: string;
  tags?: string[];
  // Additional fields vary by finding type
  [key: string]: unknown;
}

export interface FactsOutput {
  schemaVersion: string;
  generatedAt?: string;
  git: GitInfo;
  profile: ProfileInfo;
  stats: Stats;
  filters: {
    defaultExcludes: string[];
    excludes: string[];
    includes: string[];
    redact: boolean;
    maxFileBytes: number;
    maxDiffBytes: number;
    maxFindings?: number;
  };
  summary: Summary;
  categories: Array<{
    id: string;
    count: number;
    riskWeight: number;
    topEvidence: Evidence[];
  }>;
  changeset: ChangesetInfo;
  risk: RiskScore;
  findings: Finding[];
  actions: Action[];
  skippedFiles: Array<{ file: string; reason: string; detail?: string }>;
  warnings: string[];
}

// ============================================================================
// Action Input/Output Types
// ============================================================================

export interface ActionInputs {
  branchNarratorVersion: string;
  profile: string;
  redact: boolean;
  comment: boolean;
  failOnScore?: number;
  artifactName: string;
  baseSha?: string;
  headSha?: string;
  // SARIF options
  sarifUpload: boolean;
  sarifFile: string;
  // Delta mode options
  baselineArtifact?: string;
  sinceStrict: boolean;
  // File filtering
  exclude: string[];
  include: string[];
  // Category filtering
  riskOnlyCategories: string[];
  riskExcludeCategories: string[];
  // Size limits
  maxFileBytes?: number;
  maxDiffBytes?: number;
  maxFindings?: number;
  // Score explanation
  explainScore: boolean;
  // Evidence control
  maxEvidenceLines: number;
}

export interface ActionOutputs {
  riskScore: number;
  riskLevel: RiskReportLevel;
  flagCount: number;
  findingsCount: number;
  hasBlocking: boolean;
  facts: string;
  riskReport: string;
  factsTruncated: boolean;
  riskReportTruncated: boolean;
  factsArtifactName: string;
  riskArtifactName: string;
  sarifArtifactName?: string;
  deltaNewFindings?: number;
  deltaResolvedFindings?: number;
  scoreBreakdown?: string;
}

export interface DeltaInfo {
  baseline: {
    generatedAt?: string;
    findingsCount: number;
    range: {
      base: string;
      head: string;
    };
  };
  current: {
    findingsCount: number;
  };
  newFindings: string[];
  resolvedFindings: string[];
  unchangedFindings: string[];
  scopeMatch: boolean;
  scopeWarning?: string;
}

export interface FactsOutputWithDelta extends FactsOutput {
  delta?: DeltaInfo;
}

export interface RiskReportWithDelta extends RiskReport {
  delta?: {
    baseline: {
      generatedAt?: string;
      riskScore: number;
      flagsCount: number;
    };
    current: {
      riskScore: number;
      flagsCount: number;
    };
    newFlags: string[];
    resolvedFlags: string[];
    scoreDelta: number;
    scopeMatch: boolean;
    scopeWarning?: string;
  };
}

export interface RunResult {
  facts: FactsOutputWithDelta;
  riskReport: RiskReportWithDelta;
  /** Human-readable markdown from pr-body command */
  prBodyMarkdown: string;
  sarifPath?: string;
  resolvedVersion: string;
}

/**
 * Context information for rendering PR comments and step summaries.
 */
export interface RenderContext {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Head commit SHA for permalink generation */
  headSha: string;
  /** Resolved branch-narrator version */
  resolvedVersion: string;
  /** Base commit SHA */
  baseSha: string;
}
