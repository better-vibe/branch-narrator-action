
---
"branch-narrator-action": minor
---

Use pr-body CLI command for human-readable output, separate from machine-readable artifacts

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
