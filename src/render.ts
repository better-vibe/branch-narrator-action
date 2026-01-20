/**
 * Markdown rendering for Step Summary and PR comments.
 */

import type { FactsOutput, RiskReport, RiskFlag, RiskReportLevel, RenderContext, Finding } from "./types.js";

const COMMENT_MARKER = "<!-- branch-narrator:report -->";

/**
 * Shorten a SHA to 7 characters.
 */
function shortSha(sha: string): string {
  return sha.substring(0, 7);
}

/**
 * Generate a GitHub permalink to a file at a specific commit.
 */
function getGitHubFileLink(
  owner: string,
  repo: string,
  sha: string,
  file: string,
  line?: number
): string {
  const base = `https://github.com/${owner}/${repo}/blob/${sha}/${file}`;
  return line ? `${base}#L${line}` : base;
}

/**
 * Generate a GitHub compare link between two commits.
 */
function getGitHubCompareLink(
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string
): string {
  return `https://github.com/${owner}/${repo}/compare/${shortSha(baseSha)}...${shortSha(headSha)}`;
}

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
 * @param flag - The risk flag to render
 * @param index - Zero-based index for numbering
 * @param showEvidence - Whether to show evidence excerpts
 * @param context - Optional context for generating GitHub permalinks
 */
function renderFlag(
  flag: RiskFlag,
  index: number,
  showEvidence: boolean,
  context?: RenderContext
): string {
  const lines: string[] = [];

  lines.push(`${index + 1}. **${flag.title}**`);
  lines.push(`   - Rule: \`${flag.ruleKey}\``);
  lines.push(`   - Score: ${flag.effectiveScore}/100`);
  lines.push(`   - ${truncate(flag.summary, 200)}`);

  if (showEvidence && flag.evidence.length > 0) {
    const firstEvidence = flag.evidence[0];

    // Generate file link if context is available
    if (context) {
      const fileLink = getGitHubFileLink(
        context.owner,
        context.repo,
        context.headSha,
        firstEvidence.file
      );
      lines.push(`   - File: [\`${firstEvidence.file}\`](${fileLink})`);
    } else {
      lines.push(`   - File: \`${firstEvidence.file}\``);
    }

    if (firstEvidence.lines.length > 0) {
      const excerpt = firstEvidence.lines.slice(0, 3).join("\n");
      lines.push("   ```");
      lines.push(`   ${truncate(excerpt, 200)}`);
      lines.push("   ```");
    }
  }

  return lines.join("\n");
}

/**
 * Get emoji for finding category.
 */
function getCategoryEmoji(category: string): string {
  switch (category.toLowerCase()) {
    case "security":
      return "🔒";
    case "db":
    case "database":
      return "🗄️";
    case "deps":
    case "dependencies":
      return "📦";
    case "api":
      return "🔌";
    case "tests":
      return "🧪";
    case "ci":
      return "⚙️";
    case "infra":
      return "🏗️";
    case "churn":
      return "🔄";
    default:
      return "📋";
  }
}

/**
 * Render a single finding as markdown.
 * @param finding - The finding to render
 * @param index - Zero-based index for numbering
 * @param context - Optional context for generating GitHub permalinks
 */
function renderFinding(
  finding: Finding,
  index: number,
  context?: RenderContext
): string {
  const lines: string[] = [];
  const emoji = getCategoryEmoji(finding.category);

  // Build title from type and kind
  const title = finding.kind || finding.type || "Finding";
  lines.push(`${index + 1}. ${emoji} **${title}**`);
  lines.push(`   - Category: \`${finding.category}\``);
  lines.push(`   - Confidence: ${finding.confidence}`);

  // Show first evidence with file link
  if (finding.evidence.length > 0) {
    const firstEvidence = finding.evidence[0];

    if (context && context.owner && context.repo) {
      const fileLink = getGitHubFileLink(
        context.owner,
        context.repo,
        context.headSha,
        firstEvidence.file,
        firstEvidence.line
      );
      lines.push(`   - File: [\`${firstEvidence.file}\`](${fileLink})${firstEvidence.line ? ` (L${firstEvidence.line})` : ""}`);
    } else {
      lines.push(`   - File: \`${firstEvidence.file}\`${firstEvidence.line ? ` (L${firstEvidence.line})` : ""}`);
    }

    if (firstEvidence.excerpt) {
      lines.push("   ```");
      lines.push(`   ${truncate(firstEvidence.excerpt, 150)}`);
      lines.push("   ```");
    }
  }

  return lines.join("\n");
}

/**
 * Render findings summary by category.
 */
function renderFindingsSummary(findings: Finding[]): string {
  const byCategory = new Map<string, number>();
  for (const finding of findings) {
    const cat = finding.category || "other";
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
  }

  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  return sorted
    .map(([cat, count]) => `${getCategoryEmoji(cat)} ${cat}: ${count}`)
    .join(" | ");
}

export interface RenderSummaryOptions {
  facts: FactsOutput;
  riskReport: RiskReport;
  maxFlags: number;
  artifactName: string;
  context?: RenderContext;
}

/**
 * Render the GitHub Actions Step Summary.
 */
export function renderStepSummary(options: RenderSummaryOptions): string {
  const { facts, riskReport, maxFlags, artifactName, context } = options;
  const lines: string[] = [];

  // Header
  lines.push("# Branch Narrator Report");
  lines.push("");

  // Version and range info
  if (context) {
    const compareLink = getGitHubCompareLink(
      context.owner,
      context.repo,
      context.baseSha,
      context.headSha
    );
    lines.push(`**Version:** \`${context.resolvedVersion}\` | **Range:** [\`${shortSha(context.baseSha)}...${shortSha(context.headSha)}\`](${compareLink})`);
    lines.push("");
  }

  // Risk score badge
  lines.push("## Risk Assessment");
  lines.push("");
  lines.push(formatRiskBadge(riskReport.riskLevel, riskReport.riskScore));
  lines.push("");

  // Delta info (if available)
  if (context?.deltaNewFindings !== undefined || context?.deltaResolvedFindings !== undefined) {
    const newCount = context.deltaNewFindings ?? 0;
    const resolvedCount = context.deltaResolvedFindings ?? 0;

    if (newCount > 0 || resolvedCount > 0) {
      lines.push("### Delta (vs baseline)");
      lines.push("");
      if (newCount > 0) {
        lines.push(`- 🆕 **+${newCount}** new finding${newCount !== 1 ? "s" : ""}`);
      }
      if (resolvedCount > 0) {
        lines.push(`- ✅ **-${resolvedCount}** resolved finding${resolvedCount !== 1 ? "s" : ""}`);
      }
      lines.push("");
    }
  }

  // Stats
  lines.push("### Change Statistics");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Files Changed | ${facts.stats.filesChanged} |`);
  lines.push(`| Insertions | +${facts.stats.insertions} |`);
  lines.push(`| Deletions | -${facts.stats.deletions} |`);
  lines.push(`| Risk Flags | ${riskReport.flags.length} |`);
  lines.push(`| Findings | ${facts.findings.length} |`);
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
      lines.push(renderFlag(topFlags[i], i, false, context));
      lines.push("");
    }

    if (riskReport.flags.length > maxFlags) {
      lines.push(`> _${riskReport.flags.length - maxFlags} more flag(s) not shown_`);
      lines.push("");
    }
  }

  // Detailed findings (if enabled)
  const showFindings = context?.showFindings ?? true;
  const maxFindingsDisplay = context?.maxFindingsDisplay ?? 10;

  if (showFindings && facts.findings.length > 0) {
    lines.push("### Detailed Findings");
    lines.push("");
    lines.push(`**Total:** ${facts.findings.length} findings`);
    lines.push("");
    lines.push(renderFindingsSummary(facts.findings));
    lines.push("");

    const displayFindings = facts.findings.slice(0, maxFindingsDisplay);
    for (let i = 0; i < displayFindings.length; i++) {
      lines.push(renderFinding(displayFindings[i], i, context));
      lines.push("");
    }

    if (facts.findings.length > maxFindingsDisplay) {
      lines.push(`> _${facts.findings.length - maxFindingsDisplay} more finding(s) - see \`${artifactName}-facts\` artifact for full list_`);
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
  context?: RenderContext;
}

/**
 * Render the PR comment body.
 */
export function renderPRComment(options: RenderCommentOptions): string {
  const { facts, riskReport, maxFlags, artifactName, context } = options;
  const lines: string[] = [];

  // Hidden marker for comment updates
  lines.push(COMMENT_MARKER);
  lines.push("");

  // Header
  lines.push("## 🔍 Branch Narrator Report");
  lines.push("");

  // Version and range info
  if (context) {
    const compareLink = getGitHubCompareLink(
      context.owner,
      context.repo,
      context.baseSha,
      context.headSha
    );
    lines.push(`**Version:** \`${context.resolvedVersion}\` | **Range:** [\`${shortSha(context.baseSha)}...${shortSha(context.headSha)}\`](${compareLink})`);
    lines.push("");
  }

  // Risk badge
  lines.push(formatRiskBadge(riskReport.riskLevel, riskReport.riskScore));
  lines.push("");

  // Delta info (if available) - show prominently before stats
  if (context?.deltaNewFindings !== undefined || context?.deltaResolvedFindings !== undefined) {
    const newCount = context.deltaNewFindings ?? 0;
    const resolvedCount = context.deltaResolvedFindings ?? 0;

    if (newCount > 0 || resolvedCount > 0) {
      const deltaItems: string[] = [];
      if (newCount > 0) {
        deltaItems.push(`🆕 **+${newCount}** new`);
      }
      if (resolvedCount > 0) {
        deltaItems.push(`✅ **-${resolvedCount}** resolved`);
      }
      lines.push(`**Delta:** ${deltaItems.join(" | ")}`);
      lines.push("");
    }
  }

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
      lines.push(renderFlag(topFlags[i], i, true, context));
      lines.push("");
    }

    if (riskReport.flags.length > maxFlags) {
      lines.push(`> _${riskReport.flags.length - maxFlags} more flag(s) - see artifacts for full report_`);
      lines.push("");
    }

    lines.push("</details>");
    lines.push("");
  }

  // Detailed findings (if enabled)
  const showFindings = context?.showFindings ?? true;
  const maxFindingsDisplay = context?.maxFindingsDisplay ?? 10;

  if (showFindings && facts.findings.length > 0) {
    lines.push("<details>");
    lines.push(`<summary><strong>Detailed Findings (${facts.findings.length})</strong> - ${renderFindingsSummary(facts.findings)}</summary>`);
    lines.push("");

    const displayFindings = facts.findings.slice(0, maxFindingsDisplay);
    for (let i = 0; i < displayFindings.length; i++) {
      lines.push(renderFinding(displayFindings[i], i, context));
      lines.push("");
    }

    if (facts.findings.length > maxFindingsDisplay) {
      lines.push(`> _${facts.findings.length - maxFindingsDisplay} more finding(s) - see \`${artifactName}-facts\` artifact for full list_`);
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

  // Footer with artifact reference and version
  lines.push("---");
  if (context) {
    lines.push(
      `<sub>📦 Artifacts: \`${artifactName}-facts\`, \`${artifactName}-risk-report\` | \`branch-narrator@${context.resolvedVersion}\` | [Branch Narrator](https://github.com/better-vibe/branch-narrator-action)</sub>`
    );
  } else {
    lines.push(
      `<sub>📦 Artifacts: \`${artifactName}-facts\`, \`${artifactName}-risk-report\` | Generated by [Branch Narrator](https://github.com/better-vibe/branch-narrator-action)</sub>`
    );
  }

  return lines.join("\n");
}

/**
 * Get the comment marker used to identify existing comments.
 */
export function getCommentMarker(): string {
  return COMMENT_MARKER;
}
