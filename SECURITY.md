# Security Policy

## Supported versions

Security fixes are applied to the latest released version on the `main` branch. Before the first tagged release, please report issues against the current `main` commit.

## Reporting a vulnerability

Do **not** open a public issue for a suspected vulnerability. Instead, contact the repository owner through GitHub's private security-advisory workflow when available, or use the contact channel listed on the repository profile. Include a minimal reproduction, affected version or commit, impact, and any mitigation you have identified.

Please do not include credentials, private repository contents, or exploit payloads beyond what is necessary to reproduce the behavior.

## Security boundaries

Agent Groundcheck is designed to inspect untrusted repository text without executing it. The core engine reads files from Git objects, parses Markdown, and reads package manifests. It does not run commands extracted from instructions, invoke a shell with instruction content, use `eval`, or make required network requests.

Potential reports in scope include command injection through Git references or paths, unsafe handling of malformed Markdown or JSON, path traversal outside the selected Git tree, denial-of-service through pathological repository content, and unintended data exposure through the GitHub Action.
