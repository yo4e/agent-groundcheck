# Research Brief for Manus

Project: **Agent Groundcheck**  
Repository: `yo4e/agent-groundcheck`  
Research purpose: determine whether PR-time coding-agent instruction drift is a sufficiently real and underserved problem to justify implementation, and refine the MVP before substantial coding begins.

## 1. Working hypothesis

Agent Groundcheck is not intended to be a generic `AGENTS.md` or `CLAUDE.md` linter.

The proposed wedge is:

> **Detect when a repository change makes coding-agent instructions newly stale, and report that drift in the same pull request.**

Examples:

- a referenced path is deleted or renamed;
- an `npm`/`pnpm` script named in instructions is removed or renamed;
- an explicit Node/Python version in instructions diverges from authoritative repository configuration;
- a repository restructure invalidates the scope or assumptions of nested instructions.

The core engine is intended to be deterministic, local, and API-free.

## 2. Research questions

Please answer the following with current evidence and links to primary sources wherever possible.

### A. Direct competitors

Find active tools that lint, validate, audit, test, generate, or maintain coding-agent instruction/context files, including but not limited to:

- `AGENTS.md`;
- `CLAUDE.md`;
- `GEMINI.md`;
- GitHub Copilot repository instructions;
- agent skills/instructions generally.

For each competitor record:

- repository/product name and URL;
- maintainer/company;
- license;
- first release / recent activity;
- GitHub stars/forks where meaningful;
- package download numbers if available;
- supported instruction formats;
- rule count or major rule categories;
- CLI / GitHub Action / IDE / SaaS interfaces;
- whether it uses an LLM;
- whether it performs repository-grounded checks;
- whether it compares **base vs head** in a PR;
- whether it distinguishes newly introduced drift from pre-existing debt;
- whether it detects deleted/renamed path references;
- whether it detects removed/renamed package scripts;
- whether it detects runtime-version drift;
- whether it models nested instruction scope or precedence;
- whether it auto-fixes findings;
- pricing, if any;
- notable user complaints or missing features.

Pay special attention to previously surfaced names such as AgentLint, `agnix`, `instrlint`, and any newer or more established alternatives. Do not assume those are the only relevant competitors.

### B. Adjacent competitors

Research adjacent tools that may already solve part of the problem even if they are not marketed for coding-agent instructions, for example:

- documentation dead-link/path validators;
- command/script validation tools;
- configuration drift tools;
- docs-as-code CI tooling;
- policy-as-code tools;
- repository instruction generators;
- context-file health checks;
- GitHub Actions that validate Markdown references.

The goal is to determine whether Agent Groundcheck would merely bundle already-solved checks or create a useful integrated workflow.

### C. Evidence that the problem is real

Find real public examples where coding-agent instructions became stale, contradictory, or operationally wrong because the repository changed.

Look for:

- GitHub issues and pull requests;
- maintainers complaining about outdated `AGENTS.md` / `CLAUDE.md` / similar files;
- renamed or deleted paths still referenced by agent instructions;
- removed scripts or commands still prescribed by instructions;
- runtime/version statements diverging from repository config;
- nested instruction precedence confusion;
- research papers measuring instruction/context drift, contradictions, or context rot.

For each strong example, record:

- repository;
- exact stale instruction;
- repository fact that contradicted it;
- how long the drift persisted if knowable;
- whether it caused an agent/developer failure;
- whether an existing tool would have caught it.

A small corpus of concrete failures is more valuable than a large list of generic commentary.

### D. Ecosystem size and trend

Estimate the practical addressable ecosystem.

Research current adoption or prevalence of:

- `AGENTS.md`;
- `CLAUDE.md`;
- `.github/copilot-instructions.md`;
- `GEMINI.md` or related Gemini coding instructions;
- other major repository-level coding-agent instruction formats.

Prefer primary or reproducible sources. Note measurement dates and methodology. Do not combine incompatible counts as if they represent unique repositories.

### E. Instruction format semantics

For each major format, determine from official documentation:

- canonical filename(s);
- repository vs user/global scope;
- nested-file behavior;
- precedence/override rules;
- whether multiple files can apply simultaneously;
- expected Markdown structure, if any;
- whether path-specific instructions exist;
- whether symlinks or imports/includes are supported;
- official recommendations about keeping instructions current.

This research is required before Agent Groundcheck implements scope or contradiction rules.

### F. Technical feasibility

Assess whether the following can be implemented reliably without an LLM.

1. extracting high-confidence repository-relative path references from Markdown instructions;
2. detecting when those paths existed at PR base and were deleted/renamed at PR head;
3. extracting explicit `npm`/`pnpm`/`yarn` script invocations and resolving the correct workspace manifest;
4. comparing explicit Node/Python version claims to authoritative project config;
5. modeling nested instruction scope across the major formats;
6. generating GitHub PR annotations without requiring a hosted service.

Identify likely false positives, ambiguous syntax, monorepo complications, and platform-specific behavior.

### G. Naming and package availability

Research `agent-groundcheck` and close variants across:

- GitHub repositories;
- npm;
- PyPI if relevant;
- common search engines;
- product/company naming conflicts;
- obvious trademark/confusion risks.

Suggest better names only if the current name is materially problematic.

### H. OSS positioning

The project is intended to be real reusable OSS, not an application-program artifact.

Research:

- common licenses used by comparable developer tools;
- whether MIT or Apache-2.0 would create practical differences for this project;
- contribution patterns that make similar tools attractive to external maintainers;
- how competitors expose custom rule requests, suppressions, and compatibility reports.

Do not provide legal advice; identify practical conventions and tradeoffs.

## 3. Required competitor matrix

Please produce a compact comparison table with at least these columns:

| Tool | Active? | License | Formats | Repo-grounded? | Base/head PR drift? | Path drift | Script drift | Version drift | Scope model | LLM required? | GitHub Action | Adoption evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Include direct evidence for important cells. Use `unknown` rather than guessing.

## 4. Required gap analysis

After the matrix, answer explicitly:

### Is the proposed wedge already solved?

Choose one:

- **clearly underserved**;
- **partially served but meaningfully differentiable**;
- **crowded with only a weak differentiation**;
- **effectively already solved**.

Explain why.

### What is the smallest useful MVP?

Recommend no more than **three** initial checks.

For each check provide:

- user value;
- evidence of real failures;
- nearest competing implementation;
- estimated false-positive risk;
- technical difficulty;
- why it belongs in v0.1 rather than later.

### What should explicitly not be built?

Identify tempting features that would make the project duplicate competitors or become noisy.

## 5. User-validation plan

Propose a lightweight way to test demand before building a large rule set.

Prefer actions such as:

- scan a reproducible sample of public repositories and count real drift cases;
- open non-spammy issues or discussions only where a genuine defect is found;
- publish a small CLI spike and ask maintainers whether the finding would be useful in CI;
- dogfood on multiple repositories while clearly separating self-generated activity from external adoption.

Do not recommend artificial stars, manufactured downloads, spam outreach, or metrics gaming.

## 6. Codex for Open Source relevance

This project was partly motivated by the possibility of eventually applying to OpenAI's Codex for Open Source program, but the product must stand on its own.

Research the **current official** program criteria and note which kinds of evidence Agent Groundcheck could legitimately accumulate over time, such as:

- meaningful external usage;
- package downloads;
- adoption by other repositories;
- external issues/PRs;
- releases and maintenance history;
- ecosystem importance.

Do not optimize the product around star counts alone and do not assume any unpublished threshold.

## 7. Deliverables

Please return:

1. **Executive summary** — one page maximum;
2. **Competitor matrix**;
3. **Five to ten strongest real-world problem examples**;
4. **Instruction-format semantics table**;
5. **Technical feasibility and false-positive analysis**;
6. **Gap verdict** using the four-choice scale above;
7. **Recommended MVP: maximum three rules**;
8. **Naming/package availability check**;
9. **OSS license convention comparison**;
10. **Validation plan**;
11. **Go / pivot / stop recommendation**;
12. a bibliography/source list with access dates.

## 8. Research discipline

- Prefer official documentation, source repositories, package registries, and primary research papers.
- Treat blog posts and vendor marketing as secondary evidence.
- Distinguish current facts from inference.
- Record dates for fast-moving adoption metrics.
- Do not infer support for a feature from a tool's marketing headline; verify docs or source behavior.
- Do not treat GitHub stars as equivalent to active usage.
- Do not assume `AGENTS.md`, `CLAUDE.md`, and other instruction systems have identical semantics.
- Surface contradictions rather than forcing a clean narrative.

## 9. Decision after research

The repository's current `PRODUCT_BRIEF.md` and `DESIGN.md` are intentionally provisional.

After the research is complete, update the product decision in one of three directions:

- **GO** — implement the narrow differentiated MVP;
- **PIVOT** — retain the problem area but change the wedge/rule set;
- **STOP** — existing tools or weak demand make the project unnecessary.

A STOP result is acceptable. The purpose of the research is to avoid building a duplicate tool merely because the initial idea sounded plausible.
