/**
 * Markdown rendering for Step Summary and PR comments.
 *
 * This module provides thin wrappers around the CLI's pr-body output,
 * adding metadata like version info and the comment marker for updates.
 */

import type { RenderContext } from "./types.js";

const COMMENT_MARKER = "<!-- branch-narrator:report -->";

/**
 * Shorten a SHA to 7 characters.
 */
function shortSha(sha: string): string {
  return sha.substring(0, 7);
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
 * Render the GitHub Actions Step Summary.
 * Uses the CLI's pr-body output with added metadata header.
 */
export function renderStepSummary(
  prBodyMarkdown: string,
  context?: RenderContext
): string {
  const lines: string[] = [];

  // Add metadata header if context is available
  if (context && context.owner && context.repo) {
    const compareLink = getGitHubCompareLink(
      context.owner,
      context.repo,
      context.baseSha,
      context.headSha
    );
    lines.push(
      `**Version:** \`${context.resolvedVersion}\` | **Range:** [\`${shortSha(context.baseSha)}...${shortSha(context.headSha)}\`](${compareLink})`
    );
    lines.push("");
  } else if (context) {
    lines.push(`**Version:** \`${context.resolvedVersion}\``);
    lines.push("");
  }

  // Add the CLI-generated pr-body content
  lines.push(prBodyMarkdown);

  return lines.join("\n");
}

/**
 * Render the PR comment body.
 * Uses the CLI's pr-body output with comment marker and metadata.
 */
export function renderPRComment(
  prBodyMarkdown: string,
  context?: RenderContext
): string {
  const lines: string[] = [];

  // Hidden marker for comment updates
  lines.push(COMMENT_MARKER);
  lines.push("");

  // Add metadata header if context is available
  if (context && context.owner && context.repo) {
    const compareLink = getGitHubCompareLink(
      context.owner,
      context.repo,
      context.baseSha,
      context.headSha
    );
    lines.push(
      `**Version:** \`${context.resolvedVersion}\` | **Range:** [\`${shortSha(context.baseSha)}...${shortSha(context.headSha)}\`](${compareLink})`
    );
    lines.push("");
  } else if (context) {
    lines.push(`**Version:** \`${context.resolvedVersion}\``);
    lines.push("");
  }

  // Add the CLI-generated pr-body content
  lines.push(prBodyMarkdown);

  return lines.join("\n");
}

/**
 * Get the comment marker used to identify existing comments.
 */
export function getCommentMarker(): string {
  return COMMENT_MARKER;
}
