```md
# PRD: Branch Narrator GitHub Action (JavaScript Action)

## 1. Purpose

Create a public GitHub Action (separate repository) that runs `branch-narrator`
on pull requests to produce:

- A deterministic PR **risk report** and **findings** summary
- Machine-readable artifacts (`facts.json`, `risk-report.json`) suitable for AI
  agents and downstream workflows
- Optional merge gating (fail the workflow on high risk)

The Action must be reliable, secure-by-default, and stable for broad adoption.

---

## 2. Target Users & Primary Use Case

### Target users
- Teams reviewing pull requests who want a deterministic “review assistant”
- Teams using AI coding agents that benefit from stable artifacts and outputs

### Primary use case (v1)
On `pull_request` events:
1) Compute base/head SHAs from the PR payload
2) Run `branch-narrator facts` and `branch-narrator risk-report` against
   `base..head` (branch mode)
3) Publish:
   - GitHub Actions Step Summary (always)
   - PR comment (best-effort; skip on forks / insufficient permissions)
   - Upload artifacts for AI agents and automation
4) Optionally fail the workflow if risk exceeds a configured threshold

---

## 3. Non-goals (v1)

- No LLM calls, no external services
- No diff dumps in PR comment (avoid noise and secrets exposure)
- No SARIF/annotations (future enhancement)
- No “pack context” or chunked diff artifacts in v1
- No support for `pull_request_target` by default

---

## 4. Key Requirements

### 4.1 Deterministic diff scoping
For PR runs, use the PR’s SHAs, not guessed refs:
- base SHA: `pull_request.base.sha`
- head SHA: `pull_request.head.sha`

Run:
- `branch-narrator facts --mode branch --base <baseSha> --head <headSha> --no-timestamp`
- `branch-narrator risk-report --mode branch --base <baseSha> --head <headSha> --no-timestamp`

### 4.2 Outputs and artifacts
The Action must produce:
- `facts.json` (from `facts`)
- `risk-report.json` (from `risk-report`)

Upload both as GitHub artifacts.

The Action must also set outputs for downstream workflows:
- `risk-score` (0–100)
- `risk-level` (`low|medium|high` or equivalent)
- `flag-count` (integer)
- `has-blocking` (boolean-ish string: `true|false`)

### 4.3 Reporting surfaces
#### Step Summary (required)
Write a concise summary to the GitHub Actions Job Summary including:
- Risk score + level
- Top N flags (ruleKey + severity + short message)
- A small “key findings” section (if available from facts)
- Link to artifacts (or artifact names)

#### PR Comment (best-effort)
If permissions allow and PR is not from a fork, create/update a PR comment
containing:
- Risk score + level
- Top N flags with small evidence excerpts (redacted)
- Artifact references

Comment update strategy:
- Use a stable hidden marker in the comment body to avoid spamming:
  `<!-- branch-narrator:report -->`
- If marker exists, update that comment; otherwise create it.

Fork behavior:
- If PR is from a fork or PR write permissions are missing, skip comment posting
  and only write Step Summary + artifacts.

### 4.4 Security posture
- Default to redacting obvious secrets in any displayed excerpts.
- Avoid using `pull_request_target` by default.
- Keep GitHub token permissions minimal; require PR write permissions only if
  comment posting is enabled.

### 4.5 Action stability & versioning
- Publish as a JavaScript Action with bundled `dist/index.js` committed.
- Tag releases as `v1.0.0`, `v1.0.1`, etc.
- Maintain a moving major tag `v1` pointing to the latest `v1.x.y`.

---

## 5. Implementation Approach

### 5.1 Action type
- JavaScript Action (`runs: using: node20`) with `dist/index.js` produced via
  bundling (recommended: `@vercel/ncc`).
- Repository will include source TypeScript in `src/` and generated `dist/`.

### 5.2 How the Action runs branch-narrator
#### v1 (pragmatic)
Run the CLI via `npx` with an explicit pinned version:
- `npx -y branch-narrator@<version> facts ...`
- `npx -y branch-narrator@<version> risk-report ...`

This is simplest to ship and keeps Action wrapper thin.

#### Future (better, but not required for v1)
If `branch-narrator` exposes a programmatic API, switch to importing and
executing in-process for speed and reliability. This should not change the
Action interface.

### 5.3 Data flow
1) Determine PR base/head SHAs
2) Execute CLI commands to produce JSON
3) Parse JSON outputs in Node to:
   - compute top flags
   - set Action outputs
   - generate summary/comment body
4) Upload artifacts
5) Post PR comment if allowed
6) If gating is enabled and threshold exceeded, mark job failed

---

## 6. Inputs (Action configuration)

The Action should accept inputs (via `action.yml`) to control v1 behavior:

- `branch-narrator-version` (string, required): the version to run via `npx`
- `profile` (string, default `auto`)
- `redact` (boolean, default `true`) for displayed evidence in summary/comment
- `comment` (boolean, default `true`) whether to attempt PR comment posting
- `fail-on-score` (number, optional) fail workflow if risk score >= threshold
- `max-flags` (number, default `5`) number of flags to display in summary/comment
- `artifact-name` (string, default `branch-narrator`) base name for uploaded artifacts

(Exact names can be refined during implementation, but keep v1 minimal.)

---

## 7. Outputs (Action outputs)

The Action must set:
- `risk-score`
- `risk-level`
- `flag-count`
- `has-blocking`

Optionally also:
- `facts-artifact-name`
- `risk-artifact-name`

---

## 8. Permissions & Compatibility

### Recommended permissions
- `contents: read`
- `pull-requests: write` (only if comment posting enabled)

### Supported events
- `pull_request` (required)
- `workflow_dispatch` (optional for manual runs)
- Do not support `pull_request_target` in v1.

---

## 9. UX / Formatting Guidelines

### Step Summary formatting
- Keep it compact, scannable, stable.
- Prefer tables or bullet lists:
  - Risk Score
  - Top Flags (ruleKey, severity, short message)
  - Artifact names

### PR Comment formatting
- Include hidden marker at the top.
- Keep evidence minimal and redacted.
- Avoid dumping diffs.
- Always link to artifacts or instruct where to find them.

---

## 10. Repo Structure (proposed)

```
branch-narrator-action/
  action.yml
  package.json
  tsconfig.json
  src/
    main.ts          # entrypoint
    github.ts        # PR comment + summary helpers
    runner.ts        # execute branch-narrator
    render.ts        # markdown rendering for comment/summary
    types.ts         # minimal JSON types for parsed outputs
  dist/
    index.js         # bundled, committed
  README.md
  LICENSE
```

Build tooling:
- TypeScript
- `@vercel/ncc` bundling into `dist/index.js`

---

## 11. Acceptance Criteria

### Functional
- On a PR, the action runs and produces `facts.json` and `risk-report.json`.
- Artifacts are uploaded successfully.
- Step Summary is written and includes risk score and top flags.
- On non-fork PRs with permissions, a single PR comment is created or updated.
- Outputs are set and can be used by downstream jobs.
- Optional gating fails the job when risk score threshold is exceeded.

### Determinism
- JSON outputs are generated with timestamps omitted (`--no-timestamp`), so
  repeated runs over identical diffs are stable.

### Security
- Evidence displayed in summary/comment is redacted by default.
- On fork PRs, the action does not attempt to post comments (best-effort
  detection).

---

## 12. Future Enhancements (out of scope for v1)
- SARIF export for findings/flags (code scanning / annotations)
- Diff index artifacts (`dump-diff --stat`) as an optional artifact
- Additional gating rules (fail on specific flag ruleKeys)
- Programmatic library execution (no `npx`)
- Config file discovery in repo (e.g. `.branch-narratorrc`) to avoid workflow edits

---

## 13. Example Workflow Snippet (for README)

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

      - uses: org/branch-narrator-action@v1
        with:
          branch-narrator-version: "0.1.0"
          profile: "auto"
          redact: "true"
          comment: "true"
          fail-on-score: "70"
```

---
```