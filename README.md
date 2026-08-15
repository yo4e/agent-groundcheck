# Agent Groundcheck

> Detect when coding-agent instructions drift away from repository reality.

**Status:** discovery / pre-MVP. The product boundary is intentionally provisional until competitive and user-pain research is complete.

Agent Groundcheck is an open-source CLI and GitHub Action for repositories that maintain coding-agent instruction files such as `AGENTS.md`, `CLAUDE.md`, or similar guidance.

The core idea is narrower than a general instruction linter:

**When a code change makes an agent instruction stale, catch that drift in the same pull request.**

Examples:

- `AGENTS.md` says to run `npm run test:e2e`, but the PR removes that script.
- an instruction points to `docs/ARCHITECTURE.md`, but the file is renamed or deleted.
- an instruction says the project uses one runtime version while the authoritative project configuration now declares another.
- two scoped instruction files become incompatible because a directory or configuration boundary changed.

The intended default is deterministic, local, and API-free. Repository content should not need to leave the user's machine or CI runner.

## Product thesis

Coding-agent instruction files are increasingly part of repository infrastructure. Like code, CI configuration, and dependency manifests, they can become stale as the repository evolves.

Existing instruction linters may check structure, style, or known smells. Agent Groundcheck is being explored around a different question:

> **Did this change make the instructions less true than they were before?**

The first version should therefore emphasize high-confidence, repository-grounded checks and low-noise pull-request feedback rather than broad natural-language judgment.

## Planned interfaces

```bash
# Check the current repository state
agent-groundcheck check

# Compare a base and head revision and report newly introduced drift
agent-groundcheck pr-check --base origin/main --head HEAD
```

A GitHub Action is also planned so repositories can run the PR check automatically.

## Design principles

1. **Repository reality is the ground truth.** Prefer facts that can be reconstructed from files and configuration.
2. **Low false-positive rate over rule count.** A small trustworthy rule set is better than hundreds of noisy checks.
3. **Diff-aware by default in CI.** Existing debt should not block unrelated pull requests.
4. **No LLM required for core checks.** The default engine should be deterministic, reproducible, and inexpensive.
5. **Useful without lock-in.** CLI first, GitHub Action second; machine-readable output should make other CI systems possible.
6. **Explain every finding.** Reports should show the instruction location, the conflicting repository fact, and a practical remediation.

## Documents

- [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) — initial product proposal and scope
- [`docs/DESIGN.md`](docs/DESIGN.md) — working technical design
- [`docs/RESEARCH_BRIEF_FOR_MANUS.md`](docs/RESEARCH_BRIEF_FOR_MANUS.md) — competitive, ecosystem, and validation research brief

## Current decision gate

Do **not** treat the current feature list as final. Before implementation expands beyond a tiny spike, complete the research brief and answer:

- Is PR-time instruction drift a real and recurring pain?
- Which checks are already well served by existing tools?
- What narrow set of checks would make developers install this in CI?
- Which instruction-file formats and precedence rules matter first?

If the differentiated value is weak, change the scope rather than shipping a duplicate linter.
