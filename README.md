# Agent Groundcheck

> **A local, deterministic PR checker for instruction drift.** It answers one narrow question: **did this repository change make a coding-agent instruction newly false?**

Agent Groundcheck is not a generic instruction-quality linter. It compares a **base** and **head** Git revision, reports only high-confidence drift newly introduced by that change, and leaves pre-existing instruction debt non-blocking by default.

## 30-second overview

```bash
# From a clone (Node.js 20+ and Git required)
pnpm install
pnpm start -- pr-check --base origin/main --head HEAD
```

A clean run exits `0`. A newly introduced blocking finding exits `1`. Invocation or Git errors exit `2`.

Once published to npm, the same CLI will be available as:

```bash
npx agent-groundcheck pr-check --base origin/main --head HEAD
```

## Why this exists

Coding-agent instruction files often contain operational facts: a document to read, a generated directory to avoid, or the command to run before submitting a change. Normal repository work can invalidate those facts without breaking a build.

Current-state linters can report every stale reference already present in a repository. Agent Groundcheck instead compares two Git trees:

```text
findings(base) + findings(head)
        │
        ├── new       → blocking by default
        ├── existing  → reported, non-blocking
        └── fixed     → reported for visibility
```

That lets a repository adopt the check without first cleaning historical documentation debt.

## v0.1 rules

| Rule | Detects | Blocking condition in `pr-check` |
| --- | --- | --- |
| **AGC001** | A high-confidence repository-relative path in an instruction file is missing. | The path existed at base and is missing at head. A Git rename may be shown as a hint, but never creates a finding by itself. |
| **AGC002** | An explicit npm, pnpm, or yarn package-script invocation no longer resolves. | The resolved manifest contained the script at base and does not contain it at head. |

### AGC001 example

```md
# AGENTS.md
Read `docs/architecture.md` before changing the data model.
```

If a pull request deletes `docs/architecture.md` without updating that instruction, the result includes:

```text
AGC001 AGENTS.md:2
  Repository path referenced by coding-agent instructions does not exist.
  referenced path: docs/architecture.md
  suggested action: Update the instruction reference or restore the path.
```

### AGC002 example

```md
# AGENTS.md
Run `pnpm run test:e2e` before submitting.
```

If the same pull request removes `test:e2e` from the relevant `package.json`, Agent Groundcheck reports AGC002 on that instruction line.

## CLI

### Current-state check

`check` reports all high-confidence stale claims at one revision. It is useful for baseline inspection, but it does not distinguish historical debt.

```bash
agent-groundcheck check
agent-groundcheck check --ref HEAD --format json
```

### Pull-request check

`pr-check` is the recommended CI mode. It evaluates both revisions and classifies findings as `newFindings`, `existingFindings`, and `fixedFindings`.

```bash
agent-groundcheck pr-check --base origin/main --head HEAD
agent-groundcheck pr-check --base origin/main --head HEAD --format json
```

The JSON schema is intentionally plain and stable enough for CI consumers: it contains the evaluated commit IDs, finding groups, line provenance, evidence, optional rename hints, and counts of claims skipped for ambiguous resolution.

## GitHub Action

The action uses no GitHub API and requests no write permission. On `pull_request`, it reads the event's base/head SHAs locally, emits annotations for **new** findings, writes a job summary, and fails only for those new findings.

```yaml
name: Agent instruction drift

on:
  pull_request:

permissions:
  contents: read

jobs:
  groundcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: yo4e/agent-groundcheck@v1
```

For another event, or to override automatic PR resolution, provide both references explicitly:

```yaml
      - uses: yo4e/agent-groundcheck@v1
        with:
          base: ${{ github.event.before }}
          head: ${{ github.sha }}
```

`fetch-depth: 0` matters: both Git trees must be locally available for the comparison.

## Supported instruction files

v0.1 discovers the following tracked files outside common dependency/build directories:

| File | v0.1 behavior |
| --- | --- |
| `AGENTS.md` | Inspects high-confidence path and script claims. |
| `CLAUDE.md` | Inspects high-confidence path and script claims. |
| `GEMINI.md` | Inspects high-confidence path and script claims. |
| `.github/copilot-instructions.md` | Inspects high-confidence path and script claims. |

This is **content inspection**, not a claim that v0.1 implements each tool's full scope, import, precedence, glob, or symlink semantics. Cross-file scope drift is intentionally out of scope.

## Precision and safety boundaries

Agent Groundcheck chooses false negatives over noisy false positives.

- It parses Markdown with an AST parser; it does not scan whole documents with one broad regular expression.
- AGC001 accepts repository paths found in inline code, relative Markdown links, and fenced code blocks. URLs, globs, placeholders, absolute paths, parent traversal, and unstructured prose are ignored.
- Accepted path claims are resolved from the repository root in v0.1.
- AGC002 recognizes explicit npm/pnpm/yarn script invocations. Without `--workspace`, it uses the closest enclosing `package.json`. A `--workspace` reference is checked only when it uniquely matches one package name; ambiguous cases are skipped and remain non-blocking.
- The tool does not run extracted commands, evaluate repository text, call a hosted API, or change your working tree to inspect revisions.
- Base/head files are read directly from Git objects. Instruction content is treated as untrusted input, and oversized blobs are skipped.

## Limitations and non-goals

v0.1 deliberately does **not** implement runtime-version drift, semantic contradiction detection, generic Markdown/style linting, LLM scoring, automatic rewrites, arbitrary shell-command execution, or a broad static-rule catalog.

It also does not yet support arbitrary instruction filenames, full instruction-scope semantics, package-manager config workspaces, Yarn/Pnpm workspace globs, SARIF, config files, suppressions, or standalone binaries. Those are candidates only if real users demonstrate that the two-rule PR-drift wedge is useful and precise.

## Development

```bash
pnpm install
pnpm check
```

`pnpm check` runs TypeScript type checking, ESLint, unit tests, synthetic Git-repository integration tests, and the production build.

The test suite includes base/head fixtures for deletion, rename hints, pre-existing debt, synchronized instruction updates, package-script removal, nearest-manifest resolution, and ambiguous workspace handling. See [fixture provenance](tests/fixtures/PROVENANCE.md).

## Privacy and security

The core engine is local and deterministic. It makes no runtime network requests, sends no repository content to an external service, and never executes commands extracted from instruction files. For vulnerability reporting, see [SECURITY.md](SECURITY.md).

## Contributing and releases

Contributions, bug reports, rule-precision feedback, and compatibility reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md). Releases follow [Keep a Changelog](https://keepachangelog.com/) conventions in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

## Research and design trail

- [Product brief](docs/PRODUCT_BRIEF.md)
- [Technical design](docs/DESIGN.md)
- [Market and technical research report](docs/RESEARCH_REPORT_2026-08-15.md)
- [v0.1 implementation decision](docs/IMPLEMENTATION_NOTES.md)
