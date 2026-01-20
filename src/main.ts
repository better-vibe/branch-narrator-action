/**
 * Branch Narrator Action - Main entrypoint.
 */

import * as core from "@actions/core";
import { runBranchNarrator } from "./runner.js";
import { renderStepSummary, renderPRComment } from "./render.js";
import {
  getPRContext,
  writeStepSummary,
  uploadArtifacts,
  uploadSarif,
  downloadBaselineArtifact,
  cleanupTempArtifacts,
  createOrUpdateComment,
  shouldPostComment,
} from "./github.js";
import type { ActionInputs, ActionOutputs, RenderContext } from "./types.js";

/**
 * Parse a multiline or comma-separated string into an array.
 */
function parseStringList(input: string): string[] {
  if (!input.trim()) return [];
  // Split by newlines or commas, trim whitespace, filter empty
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse action inputs from the workflow.
 */
function getInputs(): ActionInputs {
  const branchNarratorVersion = core.getInput("branch-narrator-version", {
    required: true,
  });
  const profile = core.getInput("profile") || "auto";
  const redact = core.getBooleanInput("redact");
  const comment = core.getBooleanInput("comment");
  const failOnScoreInput = core.getInput("fail-on-score");
  const maxFlags = parseInt(core.getInput("max-flags") || "5", 10);
  const artifactName = core.getInput("artifact-name") || "branch-narrator";
  const baseSha = core.getInput("base-sha");
  const headSha = core.getInput("head-sha");

  // SARIF options
  const sarifUpload = core.getBooleanInput("sarif-upload");
  const sarifFile = core.getInput("sarif-file") || "branch-narrator.sarif";

  // Delta mode options
  const baselineArtifact = core.getInput("baseline-artifact") || undefined;
  const sinceStrict = core.getBooleanInput("since-strict");

  // File filtering
  const exclude = parseStringList(core.getInput("exclude"));
  const include = parseStringList(core.getInput("include"));

  // Category filtering
  const riskOnlyCategories = parseStringList(core.getInput("risk-only-categories"));
  const riskExcludeCategories = parseStringList(core.getInput("risk-exclude-categories"));

  // Size limits
  const maxFileBytesInput = core.getInput("max-file-bytes");
  const maxDiffBytesInput = core.getInput("max-diff-bytes");
  const maxFindingsInput = core.getInput("max-findings");

  let maxFileBytes: number | undefined;
  if (maxFileBytesInput) {
    maxFileBytes = parseInt(maxFileBytesInput, 10);
    if (isNaN(maxFileBytes) || maxFileBytes <= 0) {
      throw new Error(`Invalid max-file-bytes: ${maxFileBytesInput}`);
    }
  }

  let maxDiffBytes: number | undefined;
  if (maxDiffBytesInput) {
    maxDiffBytes = parseInt(maxDiffBytesInput, 10);
    if (isNaN(maxDiffBytes) || maxDiffBytes <= 0) {
      throw new Error(`Invalid max-diff-bytes: ${maxDiffBytesInput}`);
    }
  }

  let maxFindings: number | undefined;
  if (maxFindingsInput) {
    maxFindings = parseInt(maxFindingsInput, 10);
    if (isNaN(maxFindings) || maxFindings <= 0) {
      throw new Error(`Invalid max-findings: ${maxFindingsInput}`);
    }
  }

  // Score explanation
  const explainScore = core.getBooleanInput("explain-score");

  // Evidence control
  const maxEvidenceLines = parseInt(core.getInput("max-evidence-lines") || "5", 10);

  // Findings display
  const showFindings = core.getBooleanInput("show-findings");
  const maxFindingsDisplay = parseInt(core.getInput("max-findings-display") || "10", 10);

  let failOnScore: number | undefined;
  if (failOnScoreInput) {
    failOnScore = parseInt(failOnScoreInput, 10);
    if (isNaN(failOnScore) || failOnScore < 0 || failOnScore > 100) {
      throw new Error(
        `Invalid fail-on-score: ${failOnScoreInput}. Must be 0-100.`
      );
    }
  }

  return {
    branchNarratorVersion,
    profile,
    redact,
    comment,
    failOnScore,
    maxFlags,
    artifactName,
    baseSha,
    headSha,
    sarifUpload,
    sarifFile,
    baselineArtifact,
    sinceStrict,
    exclude,
    include,
    riskOnlyCategories,
    riskExcludeCategories,
    maxFileBytes,
    maxDiffBytes,
    maxFindings,
    explainScore,
    maxEvidenceLines,
    showFindings,
    maxFindingsDisplay,
  };
}

/**
 * Set action outputs.
 */
function setOutputs(outputs: ActionOutputs): void {
  core.setOutput("risk-score", outputs.riskScore.toString());
  core.setOutput("risk-level", outputs.riskLevel);
  core.setOutput("flag-count", outputs.flagCount.toString());
  core.setOutput("findings-count", outputs.findingsCount.toString());
  core.setOutput("has-blocking", outputs.hasBlocking.toString());
  core.setOutput("facts-artifact-name", outputs.factsArtifactName);
  core.setOutput("risk-artifact-name", outputs.riskArtifactName);

  // Optional outputs
  if (outputs.sarifArtifactName) {
    core.setOutput("sarif-artifact-name", outputs.sarifArtifactName);
  }
  if (outputs.deltaNewFindings !== undefined) {
    core.setOutput("delta-new-findings", outputs.deltaNewFindings.toString());
  }
  if (outputs.deltaResolvedFindings !== undefined) {
    core.setOutput("delta-resolved-findings", outputs.deltaResolvedFindings.toString());
  }
  if (outputs.scoreBreakdown) {
    core.setOutput("score-breakdown", outputs.scoreBreakdown);
  }
}

/**
 * Main action entry point.
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const inputs = getInputs();
    core.info(`Branch Narrator Action v1.1.0`);
    core.info(`Using branch-narrator@${inputs.branchNarratorVersion}`);

    // Get PR context or fall back to explicit inputs
    const prContext = getPRContext();
    const hasManualRange = Boolean(inputs.baseSha || inputs.headSha);

    if (prContext && hasManualRange) {
      core.info(
        "Ignoring base-sha/head-sha inputs because pull_request context is available."
      );
    }

    if (!prContext) {
      if (!inputs.baseSha || !inputs.headSha) {
        throw new Error(
          "Could not determine PR context. For non-pull_request events, provide base-sha and head-sha inputs."
        );
      }
      core.info("No PR context detected; using base/head from inputs");
    }

    const baseSha = prContext ? prContext.baseSha : inputs.baseSha!;
    const headSha = prContext ? prContext.headSha : inputs.headSha!;

    if (prContext) {
      core.info(`Analyzing PR #${prContext.prNumber}`);
      if (prContext.isFork) {
        core.info("PR is from a fork");
      }
    } else {
      core.info("Analyzing explicit commit range");
    }

    core.info(`Base: ${baseSha.substring(0, 7)}`);
    core.info(`Head: ${headSha.substring(0, 7)}`);

    // Download baseline artifacts if delta mode is enabled
    let baselinePath: string | undefined;
    if (inputs.baselineArtifact) {
      const baselineResult = await downloadBaselineArtifact({
        baselineArtifactName: inputs.baselineArtifact,
      });
      if (baselineResult) {
        baselinePath = baselineResult.factsPath;
        core.info(`Using baseline from: ${baselinePath}`);
      }
    }

    // Run branch-narrator
    const { facts, riskReport, sarifPath, resolvedVersion } = await runBranchNarrator({
      version: inputs.branchNarratorVersion,
      baseSha,
      headSha,
      profile: inputs.profile,
      redact: inputs.redact,
      sarifUpload: inputs.sarifUpload,
      sarifFile: inputs.sarifFile,
      baselinePath,
      sinceStrict: inputs.sinceStrict,
      exclude: inputs.exclude,
      include: inputs.include,
      riskOnlyCategories: inputs.riskOnlyCategories,
      riskExcludeCategories: inputs.riskExcludeCategories,
      maxFileBytes: inputs.maxFileBytes,
      maxDiffBytes: inputs.maxDiffBytes,
      maxFindings: inputs.maxFindings,
      explainScore: inputs.explainScore,
      maxEvidenceLines: inputs.maxEvidenceLines,
    });

    // Log version prominently
    core.notice(`branch-narrator version: ${resolvedVersion}`);

    // Upload artifacts
    const { factsArtifactName, riskArtifactName } = await uploadArtifacts({
      facts,
      riskReport,
      artifactName: inputs.artifactName,
    });

    // Upload SARIF if enabled
    let sarifArtifactName: string | undefined;
    if (inputs.sarifUpload && sarifPath) {
      const sarifResult = await uploadSarif({
        sarifPath,
        artifactName: inputs.artifactName,
      });
      sarifArtifactName = sarifResult.sarifArtifactName;
    }

    // Compute blocking status
    const hasBlocking = facts.actions.some((action) => action.blocking);

    // Extract delta info if available
    let deltaNewFindings: number | undefined;
    let deltaResolvedFindings: number | undefined;
    if (facts.delta) {
      deltaNewFindings = facts.delta.newFindings.length;
      deltaResolvedFindings = facts.delta.resolvedFindings.length;
    }

    // Build render context for enhanced output
    const renderContext: RenderContext = {
      owner: prContext?.owner ?? "",
      repo: prContext?.repo ?? "",
      headSha,
      baseSha,
      resolvedVersion,
      deltaNewFindings,
      deltaResolvedFindings,
      showFindings: inputs.showFindings,
      maxFindingsDisplay: inputs.maxFindingsDisplay,
    };

    // Render and write Step Summary
    const summaryMarkdown = renderStepSummary({
      facts,
      riskReport,
      maxFlags: inputs.maxFlags,
      artifactName: inputs.artifactName,
      context: renderContext,
    });
    await writeStepSummary(summaryMarkdown);

    // Post PR comment if enabled and not a fork
    if (prContext && shouldPostComment(prContext.isFork, inputs.comment)) {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        core.warning("GITHUB_TOKEN not available, skipping PR comment");
      } else {
        const commentBody = renderPRComment({
          facts,
          riskReport,
          maxFlags: inputs.maxFlags,
          artifactName: inputs.artifactName,
          context: renderContext,
        });

        await createOrUpdateComment({
          token,
          owner: prContext.owner,
          repo: prContext.repo,
          prNumber: prContext.prNumber,
          body: commentBody,
        });
      }
    } else if (!prContext) {
      core.info("Skipping PR comment because this is not a pull_request event");
    }

    // Extract score breakdown if available
    let scoreBreakdown: string | undefined;
    if (inputs.explainScore && riskReport.scoreBreakdown) {
      scoreBreakdown = JSON.stringify(riskReport.scoreBreakdown);
    }

    // Set outputs
    const outputs: ActionOutputs = {
      riskScore: riskReport.riskScore,
      riskLevel: riskReport.riskLevel,
      flagCount: riskReport.flags.length,
      findingsCount: facts.findings.length,
      hasBlocking,
      factsArtifactName,
      riskArtifactName,
      sarifArtifactName,
      deltaNewFindings,
      deltaResolvedFindings,
      scoreBreakdown,
    };
    setOutputs(outputs);

    // Log structured summary
    core.info("");
    core.info("┌─────────────────────────────────────────┐");
    core.info("│          Analysis Summary               │");
    core.info("├─────────────────────────────────────────┤");
    core.info(`│ Version:     ${resolvedVersion.padEnd(26)}│`);
    core.info(`│ Risk Score:  ${String(riskReport.riskScore).padEnd(4)}/100 (${riskReport.riskLevel})`.padEnd(42) + "│");
    core.info(`│ Flags:       ${String(riskReport.flags.length).padEnd(26)}│`);
    core.info(`│ Findings:    ${String(facts.findings.length).padEnd(26)}│`);
    core.info(`│ Files:       ${String(facts.stats.filesChanged).padEnd(26)}│`);
    if (deltaNewFindings !== undefined || deltaResolvedFindings !== undefined) {
      const deltaStr = `+${deltaNewFindings ?? 0} new, -${deltaResolvedFindings ?? 0} resolved`;
      core.info(`│ Delta:       ${deltaStr.padEnd(26)}│`);
    }
    core.info("└─────────────────────────────────────────┘");

    // Log findings by category if show-findings is enabled
    if (inputs.showFindings && facts.findings.length > 0) {
      const findingsByCategory = new Map<string, number>();
      for (const finding of facts.findings) {
        const cat = finding.category || "other";
        findingsByCategory.set(cat, (findingsByCategory.get(cat) || 0) + 1);
      }

      core.info("");
      core.info("Findings by category:");
      for (const [category, count] of [...findingsByCategory.entries()].sort((a, b) => b[1] - a[1])) {
        core.info(`  ${category}: ${count}`);
      }
    }
    core.info("");

    // Check fail-on-score threshold
    if (
      inputs.failOnScore !== undefined &&
      riskReport.riskScore >= inputs.failOnScore
    ) {
      core.setFailed(
        `Risk score ${riskReport.riskScore} >= threshold ${inputs.failOnScore}`
      );
      return;
    }

    core.info("Branch Narrator Action completed successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(errorMessage);
  } finally {
    // Clean up temporary files
    await cleanupTempArtifacts();
  }
}

// Run the action
run();
