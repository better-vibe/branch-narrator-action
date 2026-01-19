#!/usr/bin/env node

/**
 * Release script for GitHub Actions (not published to npm).
 * Creates a git tag and GitHub Release based on package.json version.
 *
 * Called by changesets/action after version bumps are merged.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
const version = pkg.version;
const tag = `v${version}`;

console.log(`Creating release for ${tag}...`);

// Check if tag already exists
try {
  execSync(`git rev-parse ${tag}`, { stdio: "pipe" });
  console.log(`Tag ${tag} already exists, skipping.`);
  process.exit(0);
} catch {
  // Tag doesn't exist, continue
}

// Create and push the tag
execSync(`git tag -a ${tag} -m "Release ${tag}"`, { stdio: "inherit" });
execSync(`git push origin ${tag}`, { stdio: "inherit" });

// Create GitHub Release using gh CLI
// The gh CLI is available in GitHub Actions runners
try {
  const changelogEntry = getChangelogEntry(version);
  const body = changelogEntry || `Release ${tag}`;

  execSync(
    `gh release create ${tag} --title "${tag}" --notes "${body.replace(/"/g, '\\"')}"`,
    { stdio: "inherit" }
  );
  console.log(`GitHub Release ${tag} created successfully.`);
} catch (error) {
  console.error("Failed to create GitHub Release:", error.message);
  console.log("Tag was pushed successfully. Create the release manually if needed.");
}

/**
 * Extract changelog entry for a specific version from CHANGELOG.md
 */
function getChangelogEntry(version) {
  try {
    const changelog = readFileSync("./CHANGELOG.md", "utf-8");
    const versionHeader = `## ${version}`;
    const start = changelog.indexOf(versionHeader);
    if (start === -1) return null;

    const contentStart = start + versionHeader.length;
    const nextHeader = changelog.indexOf("\n## ", contentStart);
    const end = nextHeader === -1 ? changelog.length : nextHeader;

    return changelog.slice(contentStart, end).trim();
  } catch {
    return null;
  }
}
