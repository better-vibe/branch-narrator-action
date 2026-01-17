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
  createOrUpdateComment,
  shouldPostComment,
} from "./github.js";
import type { ActionInputs, ActionOutputs } from "./types.js";

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
  };
}

/**
 * Set action outputs.
 */
function setOutputs(outputs: ActionOutputs): void {
  core.setOutput("risk-score", outputs.riskScore.toString());
  core.setOutput("risk-level", outputs.riskLevel);
  core.setOutput("flag-count", outputs.flagCount.toString());
  core.setOutput("has-blocking", outputs.hasBlocking.toString());
  core.setOutput("facts-artifact-name", outputs.factsArtifactName);
  core.setOutput("risk-artifact-name", outputs.riskArtifactName);
}

/**
 * Main action entry point.
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const inputs = getInputs();
    core.info(`Branch Narrator Action v1.0.0`);
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

    // Run branch-narrator
    const { facts, riskReport } = await runBranchNarrator({
      version: inputs.branchNarratorVersion,
      baseSha,
      headSha,
      profile: inputs.profile,
      redact: inputs.redact,
    });

    // Upload artifacts
    const { factsArtifactName, riskArtifactName } = await uploadArtifacts({
      facts,
      riskReport,
      artifactName: inputs.artifactName,
    });

    // Render and write Step Summary
    const summaryMarkdown = renderStepSummary({
      facts,
      riskReport,
      maxFlags: inputs.maxFlags,
      artifactName: inputs.artifactName,
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

    // Compute blocking status
    const hasBlocking = facts.actions.some((action) => action.blocking);

    // Set outputs
    const outputs: ActionOutputs = {
      riskScore: riskReport.riskScore,
      riskLevel: riskReport.riskLevel,
      flagCount: riskReport.flags.length,
      hasBlocking,
      factsArtifactName,
      riskArtifactName,
    };
    setOutputs(outputs);

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
  }
}

// Run the action
run();
