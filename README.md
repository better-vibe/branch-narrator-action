# Branch Narrator GitHub Action

A GitHub Action that runs [branch-narrator](https://github.com/better-vibe/branch-narrator) on pull requests to produce:

- Deterministic PR **risk report** and **findings** summary
- Machine-readable artifacts (`facts.json`, `risk-report.json`) suitable for AI agents and downstream workflows
- Optional merge gating (fail the workflow on high risk)

## Usage

```yaml
name: Branch Narrator

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  narrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: better-vibe/branch-narrator-action@v1
        with:
          branch-narrator-version: "1.7.0"
          profile: "auto"
          redact: "true"
          comment: "true"
          fail-on-score: "70"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `branch-narrator-version` | Version of branch-narrator to run via npx | Yes | - |
| `profile` | Analysis profile (auto\|sveltekit\|react\|stencil\|next\|vue\|astro\|library) | No | `auto` |
| `redact` | Redact obvious secret values in evidence excerpts | No | `true` |
| `comment` | Whether to post a PR comment with results | No | `true` |
| `fail-on-score` | Fail workflow if risk score >= threshold (0-100) | No | - |
| `max-flags` | Maximum flags to display in summary/comment | No | `5` |
| `artifact-name` | Base name for uploaded artifacts | No | `branch-narrator` |

## Outputs

| Output | Description |
|--------|-------------|
| `risk-score` | Risk score from 0-100 |
| `risk-level` | Risk level (low\|moderate\|elevated\|high\|critical) |
| `flag-count` | Total number of risk flags detected |
| `has-blocking` | Whether any blocking actions were identified |
| `facts-artifact-name` | Name of the uploaded facts artifact |
| `risk-artifact-name` | Name of the uploaded risk report artifact |

## Features

### Step Summary

The action writes a concise summary to the GitHub Actions Job Summary including:
- Risk score and level
- Top N flags (rule key, severity, short message)
- Key findings section
- Link to artifacts

### PR Comment

If permissions allow and PR is not from a fork, the action creates/updates a PR comment containing:
- Risk score and level
- Top N flags with evidence excerpts (redacted)
- Artifact references

The comment uses a stable hidden marker (`<!-- branch-narrator:report -->`) to update existing comments instead of creating new ones.

### Artifacts

The action uploads two JSON artifacts:
- `facts.json` - Structured facts about the changes
- `risk-report.json` - Risk analysis with flags and scores

### Merge Gating

Use `fail-on-score` to fail the workflow if the risk score exceeds a threshold:

```yaml
- uses: better-vibe/branch-narrator-action@v1
  with:
    branch-narrator-version: "1.7.0"
    fail-on-score: "70"  # Fail if risk >= 70
```

## Permissions

Recommended permissions:
- `contents: read` - Required to read repository contents
- `pull-requests: write` - Required only if comment posting is enabled

## Security

- Evidence excerpts are redacted by default to prevent secret exposure
- PR comments are skipped for fork PRs (insufficient permissions)
- The action does not support `pull_request_target` events

## License

MIT
