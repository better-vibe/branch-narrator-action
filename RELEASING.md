# Releasing

Releases are automated using [changesets](https://github.com/changesets/changesets) and GitHub Actions.

## How It Works

1. **Developers add changesets** when making changes
2. **CI validates** that `dist/` is up to date on every PR
3. **Changesets action** automatically creates a "Version Packages" PR when changesets are merged to `main`
4. **Merging the Version PR** triggers the release:
   - Updates `package.json` version and `CHANGELOG.md`
   - Creates a git tag (`v1.x.x`)
   - Creates a GitHub Release
   - Automatically updates the `v1` tag to point to the latest release

## Adding a Changeset

When making changes, add a changeset to document the change:

```bash
bun run changeset
```

This will prompt you to:
1. Select the type of change (major/minor/patch)
2. Write a summary of the changes

Alternatively, create a file manually in `.changeset/` with the format:

```md
---
"branch-narrator-action": minor
---

Description of changes
```

## Important: Keep dist/ Updated

CI enforces that `dist/index.js` is always in sync with source code. Before pushing:

```bash
bun run build
git add dist/
git commit -m "build: update dist"
```

If you forget, CI will fail with a `git diff --exit-code` error.

## Release Flow

```
Developer PR (with changeset)
        │
        ▼
   CI validates dist/
        │
        ▼
   Merge to main
        │
        ▼
Changesets action creates Version PR
        │
        ▼
  Review & merge Version PR
        │
        ▼
Tag + GitHub Release + v1 tag updated
```

## Manual Release (if needed)

In rare cases where you need to release manually:

1. Run checks:
   ```bash
   bun install --frozen-lockfile
   bun run typecheck
   bun run build
   git diff --exit-code  # Ensure dist is up to date
   ```

2. Version the package:
   ```bash
   bun run version
   git add .
   git commit -m "chore: release"
   ```

3. Create tag and release:
   ```bash
   bun run release:tag
   ```

4. Update major tag:
   ```bash
   git tag -f v1 v1.x.x
   git push -f origin v1
   ```

## Marketplace

The action is published to the GitHub Marketplace. After a release:
- The GitHub Release is automatically created
- Marketplace listing updates automatically if `action.yml` has proper branding

## For Consumers

Users should reference the action using the major version tag:

```yaml
- uses: better-vibe/branch-narrator-action@v1
```

Or pin to a specific version:

```yaml
- uses: better-vibe/branch-narrator-action@v1.2.3
```
