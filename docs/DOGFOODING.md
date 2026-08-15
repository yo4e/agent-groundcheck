# Dogfooding and Public-History Record

**Run date:** 2026-08-15
**Purpose:** exercise the shipped CLI against public repositories and real Git history without presenting synthetic fixtures as observed incidents.

## Method

Three public repositories with tracked `AGENTS.md` files were shallow-cloned, their recent history was deepened, and the current-state CLI was run locally. The tool then compared the twenty most recent parent/head pairs in each repository. This is an exploratory sample, not a representative corpus or an adoption claim.

| Repository | Current-state result after fixes | Recent history checked | Interpretation |
| --- | ---: | ---: | --- |
| [`Nutlope/make-comics`](https://github.com/Nutlope/make-comics) | 0 findings, 0 skipped | 20 pairs | Clean under the supported high-confidence extraction boundary. |
| [`lajarre/pi-vim`](https://github.com/lajarre/pi-vim) | 0 findings, 0 skipped | 20 pairs | Clean under the supported high-confidence extraction boundary. |
| [`medama-io/medama`](https://github.com/medama-io/medama) | 1 current-state finding, 0 skipped | 20 pairs | The remaining reference is intentionally classified as head-only/unproven in PR mode, not as a blocking drift. |

The 60 checked parent/head pairs produced **no blocking `newFindings`** and one `unprovenFinding`. In [`medama` commit `7adb4c3`](https://github.com/medama-io/medama/commit/7adb4c3c9faf613a77c01b267cee206986d0c5b3), `AGENTS.md` was first added with a reference to `core/client`; that path was absent at both the parent and head revisions. This is useful negative evidence: a head-only current-state failure does not prove that the repository change made a previously true instruction false, so the PR check must not block it.

## Findings that changed the implementation

| Observation | Risk without change | Corrective action |
| --- | --- | --- |
| `pnpm drizzle-kit push` was interpreted as a missing package script in `make-comics`. | Package binaries can be mistaken for scripts, creating noisy AGC002 current-state and PR output. | AGC002 now accepts only explicit `npm run NAME`, `pnpm run NAME`, and `yarn run NAME` claims. Short forms and package binaries are skipped. |
| TypeScript aliases such as `@/components/ui/button` and MIME values such as `text/plain` were interpreted as repository paths. | Non-path inline code could become an AGC001 false positive. | Alias-prefixed values and common MIME types are excluded. |
| Nested `AGENTS.md` files in `medama` refer to local paths such as `openapi.yaml` and `src/tracker.js`. | Resolving every path only from repository root made valid local guidance appear stale. | AGC001 now checks both repository-root and instruction-directory interpretations. |
| A nested instruction can use a root package script even without an intervening `package.json`. | AGC002 could skip a valid root-manifest claim and miss a later script removal. | The nearest-manifest resolver now falls back to the root manifest and caches manifest parsing per revision. |
| A newly added, already-invalid instruction claim was emitted as `newFindings`. | CI could fail without evidence that the PR invalidated a previously true instruction. | PR mode now emits `unprovenFindings` as non-blocking unless the same fingerprint resolved at base. |

## Validation boundary

This record improves confidence in extraction precision and the base/head contract, but it does **not** establish market demand or a true-positive rate. The next evidence gate remains: find several independently verified cases where a claim resolved at base, became invalid at head, and a maintainer judges the resulting PR feedback useful enough to keep enabled in CI.

## References

[1]: https://github.com/Nutlope/make-comics "Nutlope/make-comics"
[2]: https://github.com/lajarre/pi-vim "lajarre/pi-vim"
[3]: https://github.com/medama-io/medama "medama-io/medama"
[4]: https://github.com/medama-io/medama/commit/7adb4c3c9faf613a77c01b267cee206986d0c5b3 "medama commit 7adb4c3"
