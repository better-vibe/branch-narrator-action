# branch-narrator-action

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
