# Releasing Agent Groundcheck

Agent Groundcheck ships two independently consumable artifacts from the same commit: a GitHub Action and an npm CLI package. A release is complete only when documentation states exactly which of those artifacts is available.

## GitHub release and Action tags

The maintainer creates an annotated immutable version tag such as `v0.1.0`, then publishes a matching GitHub Release with release notes. After the release commit has passed CI, the mutable major Action tag `v1` is moved to that exact release commit. Consumers may use `yo4e/agent-groundcheck@v1` for the supported major line or pin `@v0.1.0` / a full commit SHA for an immutable reference.

The repository CI includes a local Action smoke test. It checks out complete history and invokes `uses: ./` with explicit base/head SHAs, so the committed `dist/action.js` is exercised rather than only TypeScript source.

## npm publication

The package is publication-ready when `pnpm check` and `npm pack --dry-run` pass. npm publication itself requires an npm account authorized to publish the `agent-groundcheck` package and may require 2FA or a provenance configuration controlled by the package owner. This repository does not claim npm availability until `npm view agent-groundcheck` resolves a published version.

After owner-authorized publication, validate in a clean directory:

```bash
npx agent-groundcheck@0.1.0 --help
npx agent-groundcheck@0.1.0 pr-check --base <base-sha> --head <head-sha>
```

Then update the README only if the registry result confirms the version is public.

## Pre-release checklist

| Check | Command or evidence |
| --- | --- |
| Source, tests, and bundled Action agree | `pnpm check` |
| Published npm payload is bounded and executable | `npm pack --dry-run` |
| GitHub Action works from committed bundle | CI `action-smoke` job |
| Tag points to the reviewed release commit | `git show v0.1.0` and `git ls-remote --tags origin` |
| Major Action tag points to that release | `git rev-parse v1` and `git rev-parse v0.1.0` resolve to the same commit |
| GitHub Release notes match changelog | release page and `CHANGELOG.md` |
| npm state is not overstated | `npm view agent-groundcheck version` |

## Support policy

Treat false positives in PR mode as correctness defects. A report should include the instruction line, base/head revisions, command output, and a minimal repository or public reproduction where possible. A new rule still needs a deterministic repository fact, line-level evidence, safe ambiguity behavior, and a base-valid/head-invalid proof before it can block CI.
