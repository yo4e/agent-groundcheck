# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and releases use semantic versioning.

## [Unreleased]

### Added

- Contributor, security, and release guidance.

## [0.1.0] - 2026-08-15

### Added

- TypeScript CLI with `check` and diff-aware `pr-check` commands.
- JSON and human-readable output with documented exit codes.
- AGC001 for high-confidence repository-relative paths that became stale between base and head.
- AGC002 for explicit npm, pnpm, and yarn package-script references that became stale between base and head.
- Git rename hints for AGC001 without treating rename inference as proof.
- GitHub Action support for pull-request annotations and a concise job summary.
- Unit tests and synthetic Git-history integration fixtures for the v0.1 contract.

### Security

- The engine reads Git objects directly, makes no required network requests, and never executes instruction content.

[Unreleased]: https://github.com/yo4e/agent-groundcheck/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yo4e/agent-groundcheck/releases/tag/v0.1.0
