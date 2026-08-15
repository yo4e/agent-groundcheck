# Fixture provenance

The integration suite creates temporary Git repositories at test time. Fixtures intentionally contain only the minimum files needed to exercise the base/head contract; they do not copy third-party repository content.

| Scenario | Provenance |
| --- | --- |
| Path deletion and rename | The structural pattern is informed by promptfoo/promptfoo PR #6538, which reorganized documentation and updated AGENTS.md references in the same pull request. The fixture verifies the inverse failure mode and the synchronized-update success case. |
| Existing debt | Product-contract fixture: pre-existing stale guidance must remain non-blocking in PR mode. |
| Package-script removal | Synthetic fixture because the research found no sufficiently strong public PR-level AGC002 example to encode as a test contract. |
| Closest manifest and ambiguous workspace | Synthetic fixtures implementing the documented safe-resolution policy. |

All fixture repositories use local temporary paths and a test-only Git identity. No network access or external repository checkout is required during tests.
