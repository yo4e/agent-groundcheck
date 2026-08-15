# Contributing to Agent Groundcheck

Thank you for helping keep coding-agent instructions trustworthy. This project deliberately favors **small, deterministic, explainable** checks over a large catalog of subjective lint rules.

## Before opening an issue or pull request

Please search existing issues first. A good report includes the instruction line, the repository fact that conflicts with it, the base/head revisions involved, expected behavior, actual behavior, and a minimal reproduction when possible. Do not include private repository content that you are not authorized to share.

For a proposed rule, explain why the problem is **newly introduced drift** rather than a general writing or formatting preference. A useful rule should be deterministic, repository-grounded, explainable, and likely to remain low-noise in CI.

## Local setup

Requirements are Node.js 20 or later, pnpm 10, and Git.

```bash
pnpm install
pnpm check
```

`pnpm check` runs type checking, linting, unit tests, synthetic Git-history integration tests, and the production build.

## Pull-request expectations

Keep pull requests focused. New behavior should include tests, documentation, and an explanation of its false-positive boundary. Never make the engine execute commands extracted from repository instructions, and do not add a hosted API or model dependency to core checks.

When changing base/head behavior, add or update a synthetic Git fixture. Tests should create the revisions that matter instead of relying on the contributor's working tree or a mutable external repository. If a public repository inspired the scenario, note its provenance without copying unnecessary content.

## Compatibility and precision policy

Agent Groundcheck prefers false negatives over false positives. In particular, ambiguous package/workspace resolution must skip or report non-blocking context rather than guess. Changes that broaden extraction need explicit tests showing rejected URLs, placeholders, globs, prose, or other likely noise sources.

The current v0.1 scope is AGC001 (stale repository paths) and AGC002 (stale package scripts). Runtime versions, semantic contradiction detection, generic Markdown quality rules, automatic rewriting, and arbitrary command execution are out of scope.

## Code style and releases

Use TypeScript with strict type checking. Keep dependencies small and auditable. Add an entry under the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md) for user-visible changes. Maintainers will version releases using semantic versioning.

## Code of conduct

Be respectful, constructive, and security-conscious. Harassment, disclosure of private repository content, and instructions that encourage unsafe command execution are not acceptable.
