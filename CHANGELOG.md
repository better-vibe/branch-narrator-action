# branch-narrator-action

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
