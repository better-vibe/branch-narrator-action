/**
 * Markdown rendering for Step Summary and PR comments.
 */

import type { FactsOutput, RiskReport, RiskFlag, RiskReportLevel } from "./types.js";

const COMMENT_MARKER = "<!-- branch-narrator:report -->";

/**
 * Get emoji for risk level.
 */
function getLevelEmoji(level: RiskReportLevel): string {
  switch (level) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "elevated":
      return "🟡";
    case "moderate":
      return "🔵";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
}

/**
 * Format a risk level as a badge-style string.
 */
function formatRiskBadge(level: RiskReportLevel, score: number): string {
  const emoji = getLevelEmoji(level);
  return `${emoji} **${level.toUpperCase()}** (${score}/100)`;
}

/**
 * Truncate a string with ellipsis if too long.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * Render a single flag as markdown.
 */
function renderFlag(flag: RiskFlag, index: number, showEvidence: boolean): string {
  const lines: string[] = [];

  lines.push(`${index + 1}. **${flag.title}**`);
  lines.push(`   - Rule: \`${flag.ruleKey}\``);
  lines.push(`   - Score: ${flag.effectiveScore}/100`);
  lines.push(`   - ${truncate(flag.summary, 200)}`);

  if (showEvidence && flag.evidence.length > 0) {
    const firstEvidence = flag.evidence[0];
    lines.push(`   - File: \`${firstEvidence.file}\``);

    if (firstEvidence.lines.length > 0) {
      const excerpt = firstEvidence.lines.slice(0, 3).join("\n");
      lines.push("   ```");
      lines.push(`   ${truncate(excerpt, 200)}`);
      lines.push("   ```");
    }
  }

  return lines.join("\n");
}

export interface RenderSummaryOptions {
  facts: FactsOutput;
  riskReport: RiskReport;
  maxFlags: number;
  artifactName: string;
}

/**
 * Render the GitHub Actions Step Summary.
 */
export function renderStepSummary(options: RenderSummaryOptions): string {
  const { facts, riskReport, maxFlags, artifactName } = options;
  const lines: string[] = [];

  // Header
  lines.push("# Branch Narrator Report");
  lines.push("");

  // Risk score badge
  lines.push("## Risk Assessment");
  lines.push("");
  lines.push(formatRiskBadge(riskReport.riskLevel, riskReport.riskScore));
  lines.push("");

  // Stats
  lines.push("### Change Statistics");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Files Changed | ${facts.stats.filesChanged} |`);
  lines.push(`| Insertions | +${facts.stats.insertions} |`);
  lines.push(`| Deletions | -${facts.stats.deletions} |`);
  lines.push(`| Risk Flags | ${riskReport.flags.length} |`);
  lines.push("");

  // Key findings
  if (facts.summary.highlights.length > 0) {
    lines.push("### Key Findings");
    lines.push("");
    for (const highlight of facts.summary.highlights.slice(0, 5)) {
      lines.push(`- ${highlight}`);
    }
    lines.push("");
  }

  // Top flags
  if (riskReport.flags.length > 0) {
    lines.push("### Top Risk Flags");
    lines.push("");

    const topFlags = riskReport.flags.slice(0, maxFlags);
    for (let i = 0; i < topFlags.length; i++) {
      lines.push(renderFlag(topFlags[i], i, false));
      lines.push("");
    }

    if (riskReport.flags.length > maxFlags) {
      lines.push(`> _${riskReport.flags.length - maxFlags} more flag(s) not shown_`);
      lines.push("");
    }
  }

  // Category scores (only non-zero)
  const nonZeroCategories = Object.entries(riskReport.categoryScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (nonZeroCategories.length > 0) {
    lines.push("### Category Scores");
    lines.push("");
    lines.push("| Category | Score |");
    lines.push("|----------|-------|");
    for (const [category, score] of nonZeroCategories) {
      const bar = "█".repeat(Math.floor(score / 10));
      lines.push(`| ${category} | ${score}/100 ${bar} |`);
    }
    lines.push("");
  }

  // Blocking actions
  const blockingActions = facts.actions.filter((a) => a.blocking);
  if (blockingActions.length > 0) {
    lines.push("### Blocking Actions");
    lines.push("");
    lines.push("> ⚠️ The following actions should be addressed before merging:");
    lines.push("");
    for (const action of blockingActions) {
      lines.push(`- **${action.id}**: ${action.reason}`);
    }
    lines.push("");
  }

  // Artifacts
  lines.push("### Artifacts");
  lines.push("");
  lines.push(`- \`${artifactName}-facts\` - Structured facts JSON`);
  lines.push(`- \`${artifactName}-risk-report\` - Risk analysis JSON`);
  lines.push("");

  return lines.join("\n");
}

export interface RenderCommentOptions {
  facts: FactsOutput;
  riskReport: RiskReport;
  maxFlags: number;
  artifactName: string;
}

/**
 * Render the PR comment body.
 */
export function renderPRComment(options: RenderCommentOptions): string {
  const { facts, riskReport, maxFlags, artifactName } = options;
  const lines: string[] = [];

  // Hidden marker for comment updates
  lines.push(COMMENT_MARKER);
  lines.push("");

  // Header
  lines.push("## 🔍 Branch Narrator Report");
  lines.push("");

  // Risk badge
  lines.push(formatRiskBadge(riskReport.riskLevel, riskReport.riskScore));
  lines.push("");

  // Quick stats
  lines.push(
    `📊 **${facts.stats.filesChanged}** files changed (+${facts.stats.insertions}/-${facts.stats.deletions})`
  );
  lines.push("");

  // Key findings
  if (facts.summary.highlights.length > 0) {
    lines.push("<details>");
    lines.push("<summary><strong>Key Findings</strong></summary>");
    lines.push("");
    for (const highlight of facts.summary.highlights.slice(0, 5)) {
      lines.push(`- ${highlight}`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  // Risk flags
  if (riskReport.flags.length > 0) {
    lines.push("<details open>");
    lines.push(`<summary><strong>Risk Flags (${riskReport.flags.length})</strong></summary>`);
    lines.push("");

    const topFlags = riskReport.flags.slice(0, maxFlags);
    for (let i = 0; i < topFlags.length; i++) {
      lines.push(renderFlag(topFlags[i], i, true));
      lines.push("");
    }

    if (riskReport.flags.length > maxFlags) {
      lines.push(`> _${riskReport.flags.length - maxFlags} more flag(s) - see artifacts for full report_`);
      lines.push("");
    }

    lines.push("</details>");
    lines.push("");
  }

  // Blocking actions warning
  const blockingActions = facts.actions.filter((a) => a.blocking);
  if (blockingActions.length > 0) {
    lines.push("> ⚠️ **Blocking Actions Required:**");
    for (const action of blockingActions.slice(0, 3)) {
      lines.push(`> - ${action.reason}`);
    }
    if (blockingActions.length > 3) {
      lines.push(`> - _...and ${blockingActions.length - 3} more_`);
    }
    lines.push("");
  }

  // Footer with artifact reference
  lines.push("---");
  lines.push(
    `<sub>📦 Artifacts: \`${artifactName}-facts\`, \`${artifactName}-risk-report\` | Generated by [Branch Narrator](https://github.com/better-vibe/branch-narrator-action)</sub>`
  );

  return lines.join("\n");
}

/**
 * Get the comment marker used to identify existing comments.
 */
export function getCommentMarker(): string {
  return COMMENT_MARKER;
}
