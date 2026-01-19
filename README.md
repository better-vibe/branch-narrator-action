# Branch Narrator GitHub Action

A GitHub Action that runs [branch-narrator](https://github.com/better-vibe/branch-narrator) on pull requests to produce:

- Deterministic PR **risk report** and **findings** summary
- Machine-readable artifacts (`facts.json`, `risk-report.json`) suitable for AI agents and downstream workflows
- Optional merge gating (fail the workflow on high risk)
- **SARIF output** for GitHub Code Scanning integration
- **Delta mode** for tracking changes between runs

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
          branch-narrator-version: "latest"
          profile: "auto"
          redact: "true"
          comment: "true"
          fail-on-score: "70"
```

### Advanced Usage with SARIF

```yaml
name: Branch Narrator with Code Scanning

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  narrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: better-vibe/branch-narrator-action@v1
        id: narrator
        with:
          branch-narrator-version: "1.7.0"
          sarif-upload: "true"
          fail-on-score: "70"
          risk-only-categories: "security,db,deps"
          explain-score: "true"

      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: branch-narrator.sarif

      - name: Show score breakdown
        run: echo '${{ steps.narrator.outputs.score-breakdown }}'
```

## Manual runs (workflow_dispatch)

For manual tests or non-PR events, provide explicit `base-sha` and `head-sha` and
disable PR comments:

```yaml
name: Branch Narrator (Manual)

on:
  workflow_dispatch:
    inputs:
      base-sha:
        description: "Optional base SHA"
        required: false
      head-sha:
        description: "Optional head SHA"
        required: false

jobs:
  narrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Resolve range
        id: range
        run: |
          BASE_INPUT="${{ inputs['base-sha'] }}"
          HEAD_INPUT="${{ inputs['head-sha'] }}"
          if [ -n "$BASE_INPUT" ] && [ -n "$HEAD_INPUT" ]; then
            BASE="$BASE_INPUT"
            HEAD="$HEAD_INPUT"
          else
            HEAD="$(git rev-parse HEAD)"
            BASE="$(git rev-parse HEAD^ 2>/dev/null || echo "$HEAD")"
          fi
          echo "base=$BASE" >> "$GITHUB_OUTPUT"
          echo "head=$HEAD" >> "$GITHUB_OUTPUT"

      - uses: better-vibe/branch-narrator-action@v1
        with:
          branch-narrator-version: "latest"
          comment: "false"
          base-sha: ${{ steps.range.outputs.base }}
          head-sha: ${{ steps.range.outputs.head }}
```

## Inputs

### Core Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `branch-narrator-version` | Version of branch-narrator to run via npx | Yes | - |
| `profile` | Analysis profile (auto\|sveltekit\|react\|stencil\|next\|vue\|astro\|library) | No | `auto` |
| `redact` | Redact obvious secret values in evidence excerpts | No | `true` |
| `comment` | Whether to post a PR comment with results | No | `true` |
| `fail-on-score` | Fail workflow if risk score >= threshold (0-100) | No | - |
| `max-flags` | Maximum flags to display in summary/comment | No | `5` |
| `artifact-name` | Base name for uploaded artifacts | No | `branch-narrator` |
| `base-sha` | Base commit SHA for non-pull_request runs (requires `head-sha`) | No | - |
| `head-sha` | Head commit SHA for non-pull_request runs (requires `base-sha`) | No | - |

### SARIF / Code Scanning

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `sarif-upload` | Enable SARIF generation and upload as artifact | No | `false` |
| `sarif-file` | Output path for SARIF file | No | `branch-narrator.sarif` |

### Delta Mode (Baseline Comparison)

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `baseline-artifact` | Name of previous run's artifact to compare against | No | - |
| `since-strict` | Exit with error on scope mismatch in delta mode | No | `false` |

### File Filtering

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `exclude` | Glob patterns to exclude files (newline or comma-separated) | No | - |
| `include` | Glob patterns to include only (newline or comma-separated) | No | - |

### Risk Report Options

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `risk-only-categories` | Only include these categories (comma-separated: security,ci,deps,db,infra,api,tests,churn) | No | - |
| `risk-exclude-categories` | Exclude these categories (comma-separated) | No | - |
| `explain-score` | Include detailed score breakdown in output | No | `false` |
| `max-evidence-lines` | Maximum evidence lines per flag | No | `5` |

### Size Limits

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `max-file-bytes` | Maximum file size to analyze in bytes | No | `1048576` |
| `max-diff-bytes` | Maximum diff size to analyze in bytes | No | `5242880` |
| `max-findings` | Maximum number of findings to return | No | - |

## Outputs

| Output | Description |
|--------|-------------|
| `risk-score` | Risk score from 0-100 |
| `risk-level` | Risk level (low\|moderate\|elevated\|high\|critical) |
| `flag-count` | Total number of risk flags detected |
| `has-blocking` | Whether any blocking actions were identified |
| `facts-artifact-name` | Name of the uploaded facts artifact |
| `risk-artifact-name` | Name of the uploaded risk report artifact |
| `sarif-artifact-name` | Name of the uploaded SARIF artifact (if `sarif-upload` enabled) |
| `delta-new-findings` | Count of new findings since baseline (if `baseline-artifact` provided) |
| `delta-resolved-findings` | Count of resolved findings since baseline (if `baseline-artifact` provided) |
| `score-breakdown` | JSON string of the score breakdown (if `explain-score` enabled) |

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

The action uploads JSON artifacts:
- `facts.json` - Structured facts about the changes
- `risk-report.json` - Risk analysis with flags and scores
- `branch-narrator.sarif` - SARIF output (if `sarif-upload` enabled)

### SARIF / GitHub Code Scanning

Enable SARIF output to integrate with GitHub Code Scanning. Findings appear as annotations in the PR diff view.

```yaml
- uses: better-vibe/branch-narrator-action@v1
  with:
    branch-narrator-version: "1.7.0"
    sarif-upload: "true"

# Upload SARIF to GitHub Code Scanning
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: branch-narrator.sarif
```

### Delta Mode (Baseline Comparison)

Track changes between runs by comparing against a baseline artifact from a previous workflow run:

```yaml
- uses: better-vibe/branch-narrator-action@v1
  id: narrator
  with:
    branch-narrator-version: "1.7.0"
    baseline-artifact: "branch-narrator"  # Name from previous run

- name: Check for regressions
  if: steps.narrator.outputs.delta-new-findings > 0
  run: |
    echo "New findings detected: ${{ steps.narrator.outputs.delta-new-findings }}"
    echo "Resolved findings: ${{ steps.narrator.outputs.delta-resolved-findings }}"
```

### File Filtering

Exclude or include specific files using glob patterns:

```yaml
- uses: better-vibe/branch-narrator-action@v1
  with:
    branch-narrator-version: "1.7.0"
    exclude: |
      **/generated/**
      **/vendor/**
    include: |
      src/**
      lib/**
```

### Category Filtering

Focus analysis on specific risk categories:

```yaml
- uses: better-vibe/branch-narrator-action@v1
  with:
    branch-narrator-version: "1.7.0"
    risk-only-categories: "security,db,deps"  # Only these categories
    # Or exclude specific categories:
    # risk-exclude-categories: "churn,tests"
```

Available categories: `security`, `ci`, `deps`, `db`, `infra`, `api`, `tests`, `churn`

### Merge Gating

Use `fail-on-score` to fail the workflow if the risk score exceeds a threshold:

```yaml
- uses: better-vibe/branch-narrator-action@v1
  with:
    branch-narrator-version: "latest"
    fail-on-score: "70"  # Fail if risk >= 70
```

## Permissions

Recommended permissions:
- `contents: read` - Required to read repository contents
- `pull-requests: write` - Required only if comment posting is enabled
- `security-events: write` - Required only if uploading SARIF to Code Scanning

## Security

- Evidence excerpts are redacted by default to prevent secret exposure
- PR comments are skipped for fork PRs (insufficient permissions)
- The action does not support `pull_request_target` events

## Contributing

Contributions are welcome! When making changes:

1. **Add a changeset** to document your change:
   ```bash
   bun run changeset
   ```

2. **Keep `dist/` updated** - CI enforces this:
   ```bash
   bun run build
   git add dist/
   ```

3. **Submit a PR** - CI will validate that `dist/` is in sync with source

See [RELEASING.md](RELEASING.md) for details on the automated release process.

## Versioning

Releases are automated via [changesets](https://github.com/changesets/changesets). When changesets are merged to `main`:

1. A "Version Packages" PR is automatically created
2. Merging that PR creates a GitHub Release and git tag
3. The `v1` tag is automatically updated to point to the latest release

**For consumers**: Use `@v1` to always get the latest compatible version, or pin to a specific version like `@v1.2.3`.

## License

MIT
