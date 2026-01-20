---
"branch-narrator-action": minor
---

Improved action output with version display, findings section, and GitHub permalinks

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
