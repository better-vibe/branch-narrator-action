# Releasing

## Prerequisites
- Ensure `dist/` is rebuilt and committed.
- Update README if behavior or inputs changed.
- Confirm CI is green (typecheck/build).

## Release steps
1. Install dependencies:
   - `bun install --frozen-lockfile`
2. Run checks:
   - `bun run typecheck`
   - `bun run build`
3. Commit changes (including `dist/`).
4. Tag the release commit:
   - `git tag -a v1.0.0 -m "v1.0.0"`
   - `git tag -f v1`
5. Push tags:
   - `git push origin v1.0.0`
   - `git push -f origin v1`

## Marketplace (optional)
- Ensure `action.yml` includes name, description, and branding.
- Create a GitHub Release from `v1.0.0`, then publish to the Marketplace.
