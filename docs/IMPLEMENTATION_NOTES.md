# v0.1 Implementation Notes

**Status:** implementation-ready initial release candidate
**Date:** 2026-08-15

## Decision

The research decision remains **PIVOT**: Agent Groundcheck is not a generic coding-agent instruction linter. v0.1 implements the narrow, deterministic contract below.

> Given a base and head Git revision, did the repository change make a supported coding-agent instruction newly false?

Only newly introduced drift blocks `pr-check`. Pre-existing stale instructions are returned separately as non-blocking debt.

## Implemented contract

| Area | v0.1 decision |
| --- | --- |
| Engine | TypeScript/Node.js core shared by CLI and GitHub Action. |
| Revision access | Git objects are read directly through `git ls-tree`, `git show`, and `git cat-file`; no worktree checkout or mutation is used. |
| Instruction files | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`. Content is inspected only; tool-specific scope/import/precedence semantics are not implemented. |
| AGC001 | Inline code, relative Markdown links, and fenced-code path claims. A `new` finding requires the same claim to resolve at base and be absent at head; repository-root and instruction-directory interpretations are checked for nested guidance. Git rename data is supplementary evidence only. |
| AGC002 | Only explicit `npm run`/`pnpm run`/`yarn run` invocations are claims. A `new` finding requires the resolved manifest to contain the script at base and lack it at head. The nearest enclosing `package.json`, then root manifest, is used unless `--workspace` resolves to exactly one package name. |
| Ambiguity | Skip rather than guess. Ambiguous workspace resolution is non-blocking and counted in output. |
| Output | Human-readable console text and JSON, with blocking `new`, non-blocking `unproven`, `existing`, and `fixed` groups. SARIF is intentionally deferred. |
| Action | `action.yml` uses Node 24, bundles runtime dependencies into `dist/action.js`, resolves PR SHAs from local event data or explicit inputs, creates line annotations for new findings, and requires no write permission. |

## Public-history validation status

The research report identified promptfoo PR #6538 as a concrete public example of instruction paths requiring synchronized updates during a documentation reorganization. That PR updated the paths correctly, so it is a prevention example rather than a retained broken-head test case. It informed the AGC001 fixture shape: a path valid at base, renamed or removed at head, with a line-level instruction reference.

The research report also found that directly attributable PR-time package-script drift examples were scarce. v0.1 therefore does **not** claim an observed public AGC002 incident rate. Its AGC002 behavior is restricted to an explicit, machine-verifiable base/head condition, and its fixture tests are synthetic. This is an intentional precision boundary, not a claim of real-world prevalence.

## Dogfooding update — 2026-08-15

A three-repository public sample exposed five precision issues: package binaries, short-form package commands, TypeScript import aliases, MIME types, root-only nested-path resolution, and no root-manifest fallback. These were fixed with unit/integration coverage. A 60-pair recent-history scan found one head-only invalid instruction in `medama-io/medama` commit `7adb4c3`; it is now classified as `unproven` and cannot block CI because the claim did not exist at base. The full method and boundaries are recorded in [`DOGFOODING.md`](./DOGFOODING.md).

## Fixture provenance

| Fixture scenario | Source / rationale |
| --- | --- |
| Deleted path and rename hint | Synthetic Git histories model the repository reorganization pattern documented in promptfoo PR #6538. |
| Existing stale path | Validates the core adoption property: historical debt must not fail an unrelated PR. |
| Rename with simultaneous instruction update | Validates that a correctly synchronized PR is quiet. |
| Package-script removal and nearest manifest | Synthetic, machine-verifiable scenarios for the explicit AGC002 contract. |
| Ambiguous workspace | Deliberate safe-failure scenario; no finding is emitted when a package name is not unique. |

## Known limitations and next validation gate

The v0.1 engineering wedge holds as a deterministic base/head implementation, including an explicit guard against head-only invalid claims, but the broader product wedge is **not yet externally validated**. Before broadening rules or asserting a final market GO, the project needs multiple public true-positive histories and maintainer feedback that this kind of PR feedback merits CI adoption.

Do not add runtime-version checking, cross-file semantic contradictions, generic Markdown linting, LLM scoring, automatic rewriting, arbitrary command execution, or a broad rule catalog to compensate for missing validation. If focused corpus testing and external feedback fail to show value, document a STOP decision rather than expanding into an undifferentiated linter.
