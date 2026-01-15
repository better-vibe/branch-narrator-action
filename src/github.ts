/**
 * GitHub API integration - artifacts, step summary, and PR comments.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { DefaultArtifactClient } from "@actions/artifact";
import type { FactsOutput, RiskReport } from "./types.js";
import { getCommentMarker } from "./render.js";

type Octokit = ReturnType<typeof github.getOctokit>;

/**
 * Write the Step Summary to the GitHub Actions UI.
 */
export async function writeStepSummary(markdown: string): Promise<void> {
  core.startGroup("Writing Step Summary");

  try {
    await core.summary.addRaw(markdown).write();
    core.info("Step Summary written successfully");
  } catch (error) {
    core.warning(`Failed to write Step Summary: ${error}`);
  }

  core.endGroup();
}

export interface UploadArtifactsOptions {
  facts: FactsOutput;
  riskReport: RiskReport;
  artifactName: string;
}

export interface UploadArtifactsResult {
  factsArtifactName: string;
  riskArtifactName: string;
}

/**
 * Upload facts and risk report as GitHub artifacts.
 */
export async function uploadArtifacts(
  options: UploadArtifactsOptions
): Promise<UploadArtifactsResult> {
  const { facts, riskReport, artifactName } = options;

  core.startGroup("Uploading artifacts");

  const factsArtifactName = `${artifactName}-facts`;
  const riskArtifactName = `${artifactName}-risk-report`;

  // Create temporary directory for artifact files
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "branch-narrator-"));

  try {
    // Write JSON files
    const factsPath = path.join(tempDir, "facts.json");
    const riskPath = path.join(tempDir, "risk-report.json");

    await fs.writeFile(factsPath, JSON.stringify(facts, null, 2), "utf-8");
    await fs.writeFile(riskPath, JSON.stringify(riskReport, null, 2), "utf-8");

    const artifactClient = new DefaultArtifactClient();

    // Upload facts artifact
    core.info(`Uploading ${factsArtifactName}...`);
    await artifactClient.uploadArtifact(factsArtifactName, [factsPath], tempDir, {
      compressionLevel: 6,
    });

    // Upload risk report artifact
    core.info(`Uploading ${riskArtifactName}...`);
    await artifactClient.uploadArtifact(riskArtifactName, [riskPath], tempDir, {
      compressionLevel: 6,
    });

    core.info("Artifacts uploaded successfully");
  } finally {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }

  core.endGroup();

  return { factsArtifactName, riskArtifactName };
}

export interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  baseSha: string;
  headSha: string;
  isFork: boolean;
}

/**
 * Extract PR context from GitHub event payload.
 */
export function getPRContext(): PRContext | null {
  const { context } = github;

  if (context.eventName !== "pull_request") {
    core.warning(`Event is not pull_request (got: ${context.eventName})`);
    return null;
  }

  const payload = context.payload;
  const pr = payload.pull_request;

  if (!pr) {
    core.warning("No pull_request in payload");
    return null;
  }

  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    prNumber: pr.number as number,
    baseSha: pr.base?.sha as string,
    headSha: pr.head?.sha as string,
    isFork: pr.head?.repo?.fork === true,
  };
}

/**
 * Find an existing comment with the marker.
 */
async function findExistingComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<number | null> {
  const marker = getCommentMarker();

  try {
    // List all comments on the PR
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    // Find comment with our marker
    const existingComment = comments.find(
      (comment) => comment.body?.includes(marker)
    );

    return existingComment?.id ?? null;
  } catch (error) {
    core.debug(`Failed to list comments: ${error}`);
    return null;
  }
}

export interface CreateOrUpdateCommentOptions {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}

/**
 * Create or update a PR comment.
 */
export async function createOrUpdateComment(
  options: CreateOrUpdateCommentOptions
): Promise<boolean> {
  const { token, owner, repo, prNumber, body } = options;

  core.startGroup("Posting PR comment");

  try {
    const octokit = github.getOctokit(token);

    // Check for existing comment
    const existingCommentId = await findExistingComment(
      octokit,
      owner,
      repo,
      prNumber
    );

    if (existingCommentId) {
      // Update existing comment
      core.info(`Updating existing comment (ID: ${existingCommentId})`);
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingCommentId,
        body,
      });
    } else {
      // Create new comment
      core.info("Creating new comment");
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
    }

    core.info("PR comment posted successfully");
    core.endGroup();
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for permission errors
    if (
      errorMessage.includes("Resource not accessible") ||
      errorMessage.includes("403") ||
      errorMessage.includes("Not Found")
    ) {
      core.warning(
        "Insufficient permissions to post PR comment. This is expected for fork PRs."
      );
    } else {
      core.warning(`Failed to post PR comment: ${errorMessage}`);
    }

    core.endGroup();
    return false;
  }
}

/**
 * Check if we should attempt to post a comment.
 */
export function shouldPostComment(isFork: boolean, commentEnabled: boolean): boolean {
  if (!commentEnabled) {
    core.info("PR comment posting is disabled via input");
    return false;
  }

  if (isFork) {
    core.info("Skipping PR comment for fork PR (insufficient permissions)");
    return false;
  }

  return true;
}
