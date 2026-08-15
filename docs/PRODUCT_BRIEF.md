# Agent Groundcheck — Initial Product Brief

Status: **Implemented v0.1 / validated engineering wedge**
Purpose: record the product hypothesis, the research-driven PIVOT, and the implemented v0.1 scope. Market validation remains ongoing.

## 1. Problem

Repositories are beginning to treat coding-agent instruction files as durable operational documentation. These files may tell an agent:

- which commands to run;
- which files or directories to read first;
- which generated files must not be edited;
- which runtime or package-manager versions are expected;
- which tests are mandatory;
- which scoped instructions override broader instructions.

Those statements can silently become false as normal repository changes accumulate.

This creates a specific failure mode: **instruction drift**.

A pull request may be technically correct while simultaneously making the repository's agent instructions stale. The next coding agent then follows obsolete commands, reads deleted files, applies the wrong version assumptions, or operates under contradictory repository guidance.

Human documentation has this problem too, but coding-agent instructions are unusually operational: stale text can directly affect automated code changes.

## 2. Product hypothesis

Agent Groundcheck should detect **newly introduced instruction drift** by comparing coding-agent instructions with repository facts before and after a change.

The central question is not:

> Is this instruction file well written?

It is:

> Did this repository change make an instruction less true?

That distinction is the proposed product wedge.

## 3. Target user

Initial target users:

1. maintainers of repositories that use `AGENTS.md`, `CLAUDE.md`, or equivalent coding-agent guidance;
2. teams that allow coding agents to open or modify pull requests;
3. OSS maintainers who want agent guidance to remain trustworthy without manually reviewing every instruction after structural changes.

Secondary users may include monorepo maintainers, platform teams, and organizations maintaining internal coding-agent conventions.

## 4. Core user story

> As a repository maintainer, when a pull request changes commands, paths, runtime configuration, or repository structure, I want CI to tell me whether the change made my coding-agent instructions stale, so the next agent does not follow obsolete guidance.

## 5. MVP boundary

The MVP should be intentionally small and high-confidence.

### MVP rules and research outcome

Research completed on 2026-08-15. AGC001 and AGC002 are implemented; AGC003 and AGC004 remain explicitly deferred.

#### AGC001 — Referenced path no longer exists

Detect path-like references in supported instruction files when a referenced file or directory existed at the base revision but does not exist at the head revision.

High-value variant: recognize a rename and report the likely new path.

#### AGC002 — Referenced package script no longer exists

Detect explicit `npm run test:e2e`, `pnpm run lint`, or `yarn run build` package-script references when the named script is missing from the relevant package manifest at the head revision. Short forms and package binaries are intentionally skipped.

For PR mode, prioritize scripts that existed at the base revision and were removed or renamed by the PR.

#### AGC003 — Declared runtime version conflicts with repository configuration

When an instruction states an explicit Node/Python version and the repository has an authoritative machine-readable version declaration, report a mismatch.

Potential sources include `.node-version`, `.nvmrc`, `package.json#engines`, `.python-version`, and `pyproject.toml`.

This rule requires careful precedence research before implementation.

#### AGC004 — Instruction target moved outside its scope

For nested/scoped instruction files, detect structural changes that leave instructions attached to a deleted, renamed, or materially relocated scope.

This rule may be deferred if instruction scoping semantics are not sufficiently standardized.

### Explicitly not MVP

Unless research shows a strong unmet need, do not begin with:

- generic Markdown linting;
- grammar/style scoring;
- vague "best practice" rules;
- LLM-based judgment of instruction quality;
- hundreds of static rules;
- automatic rewriting of instruction text;
- security scanning unrelated to instruction drift;
- a new agent-instruction format or standard.

## 6. Pull-request-first behavior

The defining mode should be diff-aware.

Given a base revision and a head revision:

1. evaluate relevant repository facts and instruction references at the base;
2. evaluate them again at the head;
3. identify findings present only at the head, or findings materially worsened by the change;
4. report as blocking PR-introduced drift only when the same claim resolved at base and is invalid at head;
5. report head-only invalid claims as non-blocking `unproven` findings, and pre-existing findings separately as baseline debt.

This avoids the common CI adoption problem where a new tool immediately fails on years of existing documentation debt.

## 7. Example output

```text
AGC001  AGENTS.md:42
Reference became stale in this change.

  docs/ARCHITECTURE.md

The path existed at the base revision but is missing at HEAD.
Possible rename: docs/SYSTEM_DESIGN.md

Suggested action: update the instruction reference or restore the path.
```

```text
AGC002  packages/web/AGENTS.md:18
Package script referenced by agent instructions no longer exists.

  pnpm test:e2e

packages/web/package.json removed script "test:e2e" in this change.

Suggested action: update the instruction to the replacement command.
```

## 8. Interfaces

### CLI

Proposed commands:

```bash
agent-groundcheck check
agent-groundcheck pr-check --base <ref> --head <ref>
agent-groundcheck explain AGC001
```

Potential aliases and exact package name should be researched before publication.

### GitHub Action

Desired installation experience:

```yaml
- uses: yo4e/agent-groundcheck@v1
```

The Action should annotate affected lines and provide a concise job summary.

### Machine-readable output

At least one structured output should be supported early:

- JSON; and/or
- SARIF if GitHub code-scanning integration proves useful and practical.

## 9. Trust model

The default product should require no external API and no model inference.

Reasons:

- repository contents may be private;
- deterministic findings are easier to review and reproduce;
- CI latency and cost stay low;
- maintainers can understand why a rule fired;
- the tool remains useful independently of any AI provider.

Optional model-assisted rules could be explored later as a separate, explicitly enabled layer.

## 10. What would make this worth installing?

The product succeeds only if it catches mistakes that are:

- plausible in real repositories;
- difficult to notice during normal code review;
- consequential for coding-agent behavior;
- reported with low enough noise that teams leave the check enabled.

A rule is not valuable merely because it can be implemented.

## 11. Validation before feature expansion

Before building a broad rule engine, seek evidence for the product wedge.

Minimum validation signals should include some combination of:

- examples of real instruction drift in public repositories;
- maintainers confirming the problem is annoying or consequential;
- at least one non-owner repository willing to run the tool;
- at least one externally reported bug, rule request, or compatibility need;
- evidence that the proposed checks are not already solved better by established competitors.

Do not optimize for GitHub stars alone. Prefer evidence of real installation and maintenance activity.

## 12. Open-source positioning

The project should be genuinely reusable OSS, not a repository created only for an application program.

Before public promotion:

- choose and add an explicit OSS license;
- document supported instruction formats and rule semantics;
- add contribution guidance;
- publish reproducible tests and fixtures;
- make releases and changelogs easy to audit;
- provide a clear security/privacy statement for CI use.

## 13. Success definition for v1

A credible v1 would:

1. install in one command or one GitHub Action step;
2. support a small set of common instruction files;
3. detect several high-confidence repository-grounded drift classes;
4. distinguish newly introduced PR drift from pre-existing debt;
5. produce useful line-level explanations;
6. work without sending repository content to an external service;
7. have tests built from realistic repository-change fixtures;
8. be used by repositories other than its own author's repositories.

## 14. Kill criteria

Change or stop the project if research shows that:

- existing tools already solve PR-time repository-grounded drift well;
- maintainers do not consider stale coding-agent instructions consequential;
- reliable extraction requires so much heuristic natural-language parsing that false positives dominate;
- instruction-file ecosystems are too fragmented to support useful deterministic checks;
- the tool cannot provide meaningful value beyond ordinary dead-link or package-script linting.

The goal is to find a useful OSS problem, not to preserve the initial idea at all costs.

## 15. Research decision — 2026-08-15

**Decision: PIVOT, then validate before broad implementation.**

The research confirms that coding-agent instruction drift is real, but it also confirms that current-state instruction linting is already directly served. In particular, existing tools check missing paths and package scripts against the current repository state. The differentiated product contract is therefore narrower:

> Report only deterministic instruction claims that were valid at the pull request base and became invalid at its head; treat pre-existing findings as non-blocking baseline debt.

The v0.1 implementation is limited to two checks:

1. **AGC001 — PR-introduced stale repository path.** Extract only high-confidence repository-relative path references. Report only when the same claim resolves at base and is missing at head; show a Git rename hint only as supplemental evidence. Head-only invalid claims are non-blocking because their prior validity is unproven.
2. **AGC002 — PR-introduced stale package script.** Extract only explicit `npm run`/`pnpm run`/`yarn run` invocations and report scripts that existed in the resolved manifest at base and are missing at head.

Do not ship AGC003 runtime-version drift or AGC004 scope drift in v0.1. Runtime authority needs an explicit precedence policy, and instruction scope semantics vary substantially across Codex, Claude Code, Copilot, and Gemini CLI. Do not add generic Markdown linting, quality scoring, LLM-based contradiction detection, arbitrary command execution, or automatic rewrites.

Implementation proceeds only after a reproducible public-repository corpus shows multiple true PR-introduced cases, a high manual-review precision for blocking findings, and external maintainer evidence that the check is useful in CI. If these conditions are not met, stop rather than expanding into a generic agent-instruction linter.

See [`RESEARCH_REPORT_2026-08-15.md`](./RESEARCH_REPORT_2026-08-15.md) for the evidence, competitor matrix, feasibility analysis, and validation plan. See [`IMPLEMENTATION_NOTES.md`](./IMPLEMENTATION_NOTES.md) for the final v0.1 contract, fixture provenance, and remaining external-validation gate.
