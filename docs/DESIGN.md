# Agent Groundcheck — Working Technical Design

Status: **Implemented v0.1 / external-validation-gated**
TypeScript/Node.js, the core engine, CLI, Action, and fixture tests are implemented. Broader product validation remains gated on real external usage.

## 1. Design goal

Build a deterministic engine that can answer:

> Which coding-agent instruction claims became stale because of this repository change?

The first implementation should optimize for explainability and low false positives, not broad semantic understanding.

## 1.1 Implemented v0.1 boundary

The production core is shared by `agent-groundcheck check`, `agent-groundcheck pr-check`, and the GitHub Action. It reads base/head Git objects directly, parses Markdown AST nodes, and implements only AGC001 (path drift) and AGC002 (explicit package-script drift). `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are content-inspected; full scope, precedence, import, glob, and symlink semantics are deferred.

PR mode emits `new`, `unproven`, `existing`, and `fixed` groups. Only `new` findings produce the default nonzero exit code and Action annotations: the same claim must resolve at base and fail at head. A claim first observed invalid at head is `unproven` and non-blocking. The current-state command may report any high-confidence stale claim. Ambiguous workspace resolution is skipped rather than guessed.

See [`IMPLEMENTATION_NOTES.md`](./IMPLEMENTATION_NOTES.md) for the exact extraction boundary, public-history validation status, and fixture provenance.

## 2. Implemented stack

### Language

**TypeScript / Node.js** is the initial recommendation because it provides a straightforward path to:

- an `npx`-installable CLI;
- a JavaScript-based GitHub Action;
- cross-platform filesystem and Git integration;
- JSON/package-manifest parsing;
- a single implementation shared by CLI and Action.

This choice should be revisited if ecosystem research strongly favors another distribution model.

### Distribution targets

1. npm CLI package;
2. GitHub Action;
3. optional standalone binaries later if demand exists.

## 3. High-level architecture

```text
                 +----------------------+
                 | Instruction discovery |
                 +-----------+----------+
                             |
                             v
                 +----------------------+
                 | Instruction parser    |
                 | + reference extractors|
                 +-----------+----------+
                             |
                             v
+-------------+   +----------------------+   +------------------+
| Base repo   |-->| Repository fact model|<--| Head repo        |
+-------------+   +----------------------+   +------------------+
                             |
                             v
                 +----------------------+
                 | Deterministic rules   |
                 +-----------+----------+
                             |
                             v
                 +----------------------+
                 | Diff classifier       |
                 | new / fixed / existing|
                 +-----------+----------+
                             |
                             v
                 +----------------------+
                 | Reporters             |
                 | text / JSON / Action  |
                 +----------------------+
```

## 4. Core concepts

### 4.1 Instruction source

An instruction source is a repository file recognized as coding-agent guidance.

Initial candidates:

- `AGENTS.md`;
- `CLAUDE.md`;
- `GEMINI.md`;
- `.github/copilot-instructions.md`.

**v0.1 support boundary:** files are discovered and their contents are inspected. The engine does not claim to implement each format's precedence, import, symlink, glob, or cross-file scope semantics.

Each source should have:

```ts
interface InstructionSource {
  path: string;
  kind: InstructionKind;
  scopeRoot: string;
  content: string;
}
```

### 4.2 Extracted claim

The parser should avoid pretending to understand arbitrary natural language. Instead it extracts narrow, testable claims from recognizable structures.

Examples:

```ts
type Claim =
  | PathReferenceClaim
  | PackageScriptClaim
  | RuntimeVersionClaim;
```

Every claim must retain provenance:

```ts
interface ClaimBase {
  sourcePath: string;
  line: number;
  rawText: string;
  confidence: "high" | "medium";
}
```

Low-confidence speculative claims should normally not produce blocking findings.

### 4.3 Repository fact model

Repository facts are machine-reconstructable facts such as:

- whether a path exists;
- package manifests and available scripts;
- runtime-version declarations;
- detected package/workspace boundaries;
- Git rename information where available.

Facts should not depend on an LLM.

### 4.4 Finding

```ts
interface Finding {
  ruleId: string;
  severity: "error" | "warning" | "info";
  sourcePath: string;
  line: number;
  message: string;
  evidence: Evidence[];
  remediation?: string;
  fingerprint: string;
}
```

A stable fingerprint is important for comparing base and head results.

## 5. Diff-aware algorithm

The proposed PR mode should not simply lint HEAD.

### 5.1 Evaluate both states

For base revision `B` and head revision `H`:

```text
claims(B) + facts(B) -> findings(B)
claims(H) + facts(H) -> findings(H)
```

Then classify:

```text
new findings      = findings(H) - findings(B)
fixed findings    = findings(B) - findings(H)
existing findings = intersection/findings matched by stable fingerprint
```

Only **new findings** should fail the PR by default.

### 5.2 Why this matters

A repository may already have stale instructions. Requiring maintainers to clean all historical debt before adopting the tool creates needless friction.

Diff-aware classification lets a team install Agent Groundcheck today and enforce only:

> Do not make the instructions worse.

## 6. Instruction discovery

### 6.1 Discovery strategy

The engine should walk the repository for supported instruction filenames while respecting common ignore boundaries:

- `.git`;
- dependency/vendor directories;
- generated output directories only when confidently identifiable;
- configurable excludes.

### 6.2 Scope semantics

Some instruction formats may apply recursively from a directory root, while others may be repository-global or tool-specific.

Do not invent a universal precedence model.

Create an adapter per instruction kind:

```ts
interface InstructionAdapter {
  discover(repo: RepoView): Promise<InstructionSource[]>;
  getScope(source: InstructionSource): InstructionScope;
}
```

Any cross-file conflict rule must operate on verified format semantics.

## 7. Claim extraction

### 7.1 Markdown parsing

Use a real Markdown parser rather than regex over the entire document.

Important nodes:

- inline code;
- fenced code blocks;
- links;
- plain-text paragraphs and list items.

### 7.2 Path reference extraction

High-confidence examples:

```text
Read `docs/ARCHITECTURE.md` first.
Do not edit `src/generated/`.
See ./scripts/release.ts.
```

Avoid treating arbitrary slash-containing prose or URLs as repository paths.

Potential normalization:

- strip punctuation;
- normalize `./`;
- check repository-root and instruction-directory candidates for nested guidance;
- preserve directory suffix `/`;
- reject URL schemes, import aliases, and MIME types;
- reject obvious shell switches.

### 7.3 Package-script extraction

Recognize only explicit `run` invocations such as:

```text
npm run test:e2e
pnpm run lint
yarn run build
npm run build --workspace web
```

The extractor must identify the relevant package/workspace context before checking a manifest.

Do not initially attempt to prove arbitrary shell commands exist.

### 7.4 Runtime-version extraction

This is useful but heuristically harder.

Candidate explicit forms:

```text
Use Node 22.
Requires Python 3.12.
Run this repository with Node.js 24.x.
```

A finding should require both:

1. a high-confidence explicit version claim in instructions; and
2. a clearly authoritative, conflicting repository declaration.

If multiple repository declarations disagree, report repository configuration ambiguity rather than blaming the instruction file.

## 8. Initial rule design

### AGC001 — stale-path

**Purpose:** detect instruction path references that no longer resolve.

Current-state behavior:

- warning/error when a high-confidence repository-relative path does not exist.

PR behavior:

- highest priority when the path resolved at base and no longer resolves at head;
- if Git reports a rename, include the likely replacement path.

False-positive controls:

- ignore URLs;
- ignore globs unless explicitly supported;
- ignore example placeholders;
- allow suppression comments/config.

### AGC002 — stale-package-script

**Purpose:** detect instruction commands that reference missing package scripts.

PR behavior is especially valuable when the named script existed at base and was removed or renamed at head. Short forms and package binaries are skipped because they cannot reliably be distinguished from package scripts without additional repository-specific semantics.

Possible future enhancement: suggest a replacement when one script was renamed and the command body remains similar.

### AGC003 — runtime-version-drift

**Purpose:** detect explicit instruction runtime versions that disagree with authoritative repository configuration.

Ship only after precedence research and fixture coverage are strong.

### AGC004 — scope-drift

**Purpose:** detect instruction scope becoming invalid after structural movement/deletion.

Likely post-MVP unless research provides a simple deterministic definition.

## 9. Git abstraction

Define a repository view independent of the working tree:

```ts
interface RepoView {
  ref: string;
  exists(path: string): Promise<boolean>;
  readText(path: string): Promise<string | null>;
  listFiles(): Promise<string[]>;
}
```

Possible implementations:

- current filesystem view;
- Git object view via `git show <ref>:<path>` / `git ls-tree`;
- temporary worktree only if necessary.

Prefer Git object access over mutating the user's working tree.

For PR rename hints, use `git diff --name-status -M <base>...<head>`.

## 10. Configuration

Proposed file:

```text
.agent-groundcheck.yml
```

Keep configuration optional.

Candidate fields:

```yaml
version: 1
instruction_files:
  - AGENTS.md
  - CLAUDE.md
exclude:
  - vendor/**
rules:
  AGC003:
    enabled: false
```

Avoid large custom rule DSLs in v1.

## 11. Suppression model

False positives must be suppressible without deleting useful instruction text.

Potential mechanisms:

1. config-based path/rule ignores;
2. line-level Markdown comments, for example:

```md
<!-- groundcheck-ignore AGC001: generated during release -->
```

Exact syntax should be selected only after research into competing tools and developer expectations.

Suppressions should require an optional reason and appear in machine-readable output.

## 12. Reporters

### Console

Human-readable, concise, stable.

### JSON

Required for integration and tests.

### GitHub Action

Desired features:

- workflow annotations at instruction lines;
- job summary grouped by rule;
- exit nonzero only for configured blocking newly introduced findings.

### SARIF

Evaluate during research. Use only if it improves GitHub integration enough to justify complexity.

## 13. Exit codes

Proposed:

```text
0 = no blocking findings
1 = blocking findings
2 = configuration/runtime error
```

Do not conflate a broken tool invocation with a repository finding.

## 14. Performance target

For an ordinary repository, target a few seconds or less in CI.

Guidelines:

- parse each instruction file once;
- parse each relevant manifest/config once per revision;
- avoid checking every repository file against every claim;
- cache normalized file indexes;
- do not invoke network services.

Large-monorepo performance should be measured before claiming support.

## 15. Security and privacy

Core checks should:

- perform no network requests;
- execute no repository commands from instruction text;
- never `eval` or shell-execute extracted content;
- treat all repository text as untrusted input;
- avoid following symlinks outside the repository boundary;
- avoid reading secrets unnecessarily;
- cap input sizes and pathological parser cases.

The parser validates claims about commands; it does **not** run those commands.

## 16. Testing strategy

### Unit tests

For:

- claim extraction;
- normalization;
- rule evaluation;
- finding fingerprinting;
- base/head classification.

### Repository fixtures

The most important tests should use tiny synthetic Git repositories representing actual changes.

Examples:

1. path exists at base -> path deleted at head -> AGC001 new;
2. path renamed -> AGC001 with rename hint;
3. stale path already exists in base -> remains stale at head -> not PR-blocking;
4. npm script exists at base -> removed at head -> AGC002 new;
5. unrelated code change -> no new finding;
6. instruction updated in same PR as rename -> no finding.

### Dogfooding

Run the tool against multiple real repositories owned by the project author, but keep those results separate from the test contract. Dogfooding is useful for discovering heuristics; it should not encode repository-specific assumptions into core rules.

## 17. Proposed repository layout

```text
agent-groundcheck/
├── README.md
├── package.json
├── tsconfig.json
├── action.yml
├── src/
│   ├── cli.ts
│   ├── core/
│   │   ├── discover.ts
│   │   ├── markdown.ts
│   │   ├── claims.ts
│   │   ├── repo-view.ts
│   │   └── diff.ts
│   ├── adapters/
│   │   ├── agents-md.ts
│   │   └── claude-md.ts
│   ├── rules/
│   │   ├── AGC001-stale-path.ts
│   │   └── AGC002-stale-package-script.ts
│   └── reporters/
│       ├── console.ts
│       ├── json.ts
│       └── github.ts
├── tests/
│   ├── unit/
│   └── fixtures/
└── docs/
```

Do not scaffold all modules until the research gate confirms the wedge.

## 18. Implementation history and future slices

### Slice 0 — research and corpus

No product implementation beyond disposable spikes.

Collect real examples of stale instruction references and map competitor capabilities.

### Slice 1 — current-state AGC001

- discover `AGENTS.md`;
- extract high-confidence path references;
- check current filesystem;
- console + JSON output;
- fixture tests.

This proves whether claim extraction can be trustworthy.

### Slice 2 — diff-aware AGC001

- base/head repository views;
- stable finding fingerprints;
- newly introduced vs existing drift;
- rename hints.

This proves the actual product wedge.

### Slice 3 — AGC002

Add package-script drift with workspace-aware fixture tests.

### Slice 4 — GitHub Action

Package the engine for pull-request CI and annotations.

### Slice 5 — only after external feedback

Choose the next rule from actual user demand, not from a desire to increase rule count.

## 19. Major open questions

1. Which instruction formats have sufficiently clear scoping semantics to support first-class adapters?
2. How common are stale path/script references in active public repositories?
3. Do existing competitors already perform base/head drift classification?
4. Should a current-state `check` report all stale claims, or only high-confidence ones?
5. What is the best package/action installation UX?
6. Is `agent-groundcheck` sufficiently distinct and available across GitHub/npm naming surfaces?
7. Which explicit OSS license is appropriate?
8. What output format best supports GitHub without making setup cumbersome?

These questions should be answered by the research brief before the design is treated as stable.
