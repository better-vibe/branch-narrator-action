# branch-narrator-action

## 1.3.1

### Patch Changes

- 9fb9307: remove non-existent redact flag from pr-body command

## 1.3.0

### Minor Changes

- fed7440: Use pr-body CLI command for human-readable output, separate from machine-readable artifacts

  **Architecture changes:**

  - **Human-readable output**: Step summary and PR comments now use the `pr-body` CLI command, which is optimized for human reviewers
  - **Machine-readable artifacts**: `facts.json` and `risk-report.json` remain unchanged for CI pipelines, coding agents, and downstream workflows
  - **Simplified rendering**: Removed custom markdown rendering in favor of CLI-generated output

  **New features:**

  - **Version resolution**: The action now resolves and displays the actual branch-narrator version (e.g., `latest` resolves to `1.2.3`)
  - **Commit range links**: PR comments and step summary include clickable compare links
  - **Enhanced pipeline logs**: Structured summary box with version, scores, flags, findings, and delta info

  **Removed inputs** (now handled by CLI):

  - `max-flags`
  - `show-findings`
  - `max-findings-display`

  **New outputs:**

  - `findings-count`: Total number of findings detected
  - `facts`: Full facts JSON output as step output (with 1MB truncation handling)
  - `risk-report`: Full risk report JSON output as step output (with 1MB truncation handling)

  **Documentation:**

  - Added `GITHUB_TOKEN` environment variable requirement to all examples
  - Updated documentation to reflect new architecture
  - Added examples for using JSON outputs in downstream workflow steps

### Patch Changes

- e821b9d: fix range commit link

## 1.2.0

### Minor Changes

- 87510dc: Improved action output with version display, findings section, and GitHub permalinks

  **New features:**

  - **Version resolution**: The action now resolves and displays the actual branch-narrator version (e.g., `latest` resolves to `1.2.3`)
  - **Detailed findings section**: Shows findings from `facts.json` with category breakdown and file permalinks (enabled by default)
  - **GitHub permalinks**: File paths in risk flags and findings now link directly to the code on GitHub
  - **Commit range links**: PR comments and step summary include clickable compare links
  - **Enhanced pipeline logs**: Structured summary box with version, scores, flags, findings, and delta info

  **New inputs:**

  - `show-findings`: Show detailed findings section in summary/comment (default: `true`)
  - `max-findings-display`: Maximum findings to display (default: `10`)

  **New outputs:**

  - `findings-count`: Total number of findings detected

  **Documentation:**

  - Added `GITHUB_TOKEN` environment variable requirement to all examples
  - Documented new inputs/outputs and features
  - Added "Environment Variables", "Findings Display", and "Pipeline Logs" sections

## 1.1.0

### Minor Changes

- 5d41b71: Add new features from branch-narrator CLI:

  - **SARIF output**: Enable GitHub Code Scanning integration with `sarif-upload` input
  - **Delta mode**: Compare against baseline artifacts with `baseline-artifact` input to track new/resolved findings
  - **File filtering**: Exclude or include files with glob patterns using `exclude` and `include` inputs
  - **Category filtering**: Focus on specific risk categories with `risk-only-categories` and `risk-exclude-categories`
  - **Size limits**: Control analysis scope with `max-file-bytes`, `max-diff-bytes`, and `max-findings`
  - **Score explanation**: Get detailed score breakdown with `explain-score` input
  - **Evidence control**: Limit evidence lines with `max-evidence-lines` input

  New outputs:

  - `sarif-artifact-name`: Name of the SARIF artifact
  - `delta-new-findings`: Count of new findings since baseline
  - `delta-resolved-findings`: Count of resolved findings since baseline
  - `score-breakdown`: JSON string of the score breakdown
