#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/cli.ts
var cli_exports = {};
__export(cli_exports, {
  runCli: () => runCli
});
module.exports = __toCommonJS(cli_exports);
var import_node_path3 = __toESM(require("path"));
var import_node_process = __toESM(require("process"));

// src/core/discover.ts
var IGNORED_SEGMENTS = /* @__PURE__ */ new Set([
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor"
]);
function instructionKind(path4) {
  if (path4.endsWith("/AGENTS.md") || path4 === "AGENTS.md") return "agents";
  if (path4.endsWith("/CLAUDE.md") || path4 === "CLAUDE.md") return "claude";
  if (path4.endsWith("/GEMINI.md") || path4 === "GEMINI.md") return "gemini";
  if (path4 === ".github/copilot-instructions.md") return "copilot";
  return void 0;
}
function isIgnored(path4) {
  return path4.split("/").some((segment) => IGNORED_SEGMENTS.has(segment));
}
async function discoverInstructionSources(view) {
  const files = await view.listFiles();
  const candidates = files.filter((path4) => !isIgnored(path4) && instructionKind(path4));
  const sources = [];
  for (const path4 of candidates) {
    const content = await view.readText(path4);
    const kind = instructionKind(path4);
    if (content !== null && kind) sources.push({ path: path4, kind, content });
  }
  return sources;
}

// src/core/git.ts
var import_node_child_process = require("child_process");
var import_node_util = require("util");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
var MAX_TEXT_BYTES = 1e6;
async function git(cwd, args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_TEXT_BYTES + 16384
    });
    return stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Git command failed: git ${args.join(" ")}
${detail}`);
  }
}
var GitRepoView = class {
  constructor(cwd, ref) {
    this.cwd = cwd;
    this.ref = ref;
  }
  cwd;
  ref;
  async resolveRef() {
    return (await git(this.cwd, ["rev-parse", "--verify", this.ref])).trim();
  }
  async listFiles() {
    const output = await git(this.cwd, ["ls-tree", "-r", "--name-only", this.ref]);
    return output.split("\n").filter(Boolean);
  }
  async exists(path4) {
    try {
      await git(this.cwd, ["cat-file", "-e", `${this.ref}:${path4}`]);
      const type = (await git(this.cwd, ["cat-file", "-t", `${this.ref}:${path4}`])).trim();
      return type === "blob" || type === "tree";
    } catch {
      return false;
    }
  }
  async readText(path4) {
    try {
      const type = (await git(this.cwd, ["cat-file", "-t", `${this.ref}:${path4}`])).trim();
      if (type !== "blob") return null;
      const size = Number((await git(this.cwd, ["cat-file", "-s", `${this.ref}:${path4}`])).trim());
      if (!Number.isFinite(size) || size > MAX_TEXT_BYTES) return null;
      return await git(this.cwd, ["show", `${this.ref}:${path4}`]);
    } catch {
      return null;
    }
  }
};
async function renameHints(cwd, base, head) {
  const output = await git(cwd, ["diff", "--name-status", "-M", base, head]);
  const hints = /* @__PURE__ */ new Map();
  for (const line of output.split("\n")) {
    const parts = line.split("	");
    if (parts.length === 3 && parts[0].startsWith("R")) hints.set(parts[1], parts[2]);
  }
  return hints;
}

// src/core/markdown.ts
var import_mdast_util_from_markdown = require("mdast-util-from-markdown");
var SCRIPT_PATTERN = /\b(npm|pnpm|yarn)\s+run\s+([A-Za-z0-9][A-Za-z0-9:_-]*)(?:\s+--workspace(?:=|\s+)([A-Za-z0-9@/_-]+))?/g;
var MIME_TYPE_PREFIXES = /* @__PURE__ */ new Set(["application", "audio", "font", "image", "message", "model", "multipart", "text", "video"]);
function lineFor(node, fallback) {
  return node.position?.start?.line ?? fallback;
}
function normalizePath(candidate) {
  let value = candidate.trim().replace(/^[`'"(]+|[`'"),.;:]+$/g, "");
  if (!value || value === "." || value === "..") return void 0;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|~\/|#|@)/i.test(value)) return void 0;
  value = value.split(/[?#]/, 1)[0];
  if (!value) return void 0;
  if (value.includes("${") || value.includes("{{") || /[*?[]/.test(value)) return void 0;
  const [firstSegment, secondSegment, ...remainingSegments] = value.split("/");
  if (remainingSegments.length === 0 && MIME_TYPE_PREFIXES.has(firstSegment) && Boolean(secondSegment)) return void 0;
  value = value.replace(/^\.\//, "");
  if (value.startsWith("../") || value.includes("/../")) return void 0;
  if (!value.includes("/") && !/^[A-Za-z0-9_.-]+\.(?:md|mdx|json|ya?ml|toml|[cm]?[jt]sx?|py|sh)$/i.test(value)) {
    return void 0;
  }
  return value.replace(/\/+/g, "/").replace(/^\/+/, "");
}
function extractPathClaim(source, rawText, line) {
  const targetPath = normalizePath(rawText);
  if (!targetPath) return void 0;
  return {
    ruleId: "AGC001",
    sourcePath: source.path,
    line,
    rawText,
    targetPath
  };
}
function extractScriptClaims(source, rawText, line) {
  const claims = [];
  for (const match of rawText.matchAll(SCRIPT_PATTERN)) {
    const packageManager = match[1];
    const scriptName = match[2];
    claims.push({
      ruleId: "AGC002",
      sourcePath: source.path,
      line,
      rawText,
      packageManager,
      scriptName,
      workspace: match[3]
    });
  }
  return claims;
}
function claimsFromText(source, rawText, line) {
  const claims = [...extractScriptClaims(source, rawText, line)];
  const pathClaim = extractPathClaim(source, rawText, line);
  if (pathClaim) claims.push(pathClaim);
  return claims;
}
function visit(node, callback) {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}
function extractClaims(source) {
  const root = (0, import_mdast_util_from_markdown.fromMarkdown)(source.content);
  const claims = [];
  visit(root, (node) => {
    if (node.type === "inlineCode" && typeof node.value === "string") {
      claims.push(...claimsFromText(source, node.value, lineFor(node, 1)));
    }
    if (node.type === "code" && typeof node.value === "string") {
      const startLine = lineFor(node, 1) + 1;
      node.value.split("\n").forEach((value, index) => {
        claims.push(...claimsFromText(source, value, startLine + index));
      });
    }
    if (node.type === "link" && typeof node.url === "string") {
      const pathClaim = extractPathClaim(source, node.url, lineFor(node, 1));
      if (pathClaim) claims.push(pathClaim);
    }
  });
  return claims;
}

// src/core/packages.ts
var import_node_path = __toESM(require("path"));
function parseManifest(pathname, content) {
  try {
    const value = JSON.parse(content);
    const scripts = typeof value.scripts === "object" && value.scripts !== null ? Object.fromEntries(
      Object.entries(value.scripts).filter(
        ([, command]) => typeof command === "string"
      )
    ) : {};
    return {
      path: pathname,
      name: typeof value.name === "string" ? value.name : void 0,
      scripts
    };
  } catch {
    return void 0;
  }
}
var manifestCache = /* @__PURE__ */ new WeakMap();
function manifests(view) {
  const cached = manifestCache.get(view);
  if (cached) return cached;
  const parsed = (async () => {
    const files = (await view.listFiles()).filter((pathname) => import_node_path.default.posix.basename(pathname) === "package.json");
    const entries = await Promise.all(
      files.map(async (pathname) => {
        const content = await view.readText(pathname);
        return content === null ? void 0 : parseManifest(pathname, content);
      })
    );
    return entries.filter((manifest) => Boolean(manifest));
  })();
  manifestCache.set(view, parsed);
  return parsed;
}
function closestManifest(sourcePath, allManifests) {
  const sourceDirectory = import_node_path.default.posix.dirname(sourcePath);
  const candidates = allManifests.filter((manifest) => {
    const manifestDirectory = import_node_path.default.posix.dirname(manifest.path);
    return manifestDirectory === "." || sourceDirectory === manifestDirectory || sourceDirectory.startsWith(`${manifestDirectory}/`);
  }).sort((left, right) => import_node_path.default.posix.dirname(right.path).length - import_node_path.default.posix.dirname(left.path).length);
  return candidates[0];
}
async function resolvePackageManifest(view, claim) {
  const allManifests = await manifests(view);
  let manifest;
  if (claim.workspace) {
    const matches = allManifests.filter((candidate) => candidate.name === claim.workspace);
    if (matches.length !== 1) return void 0;
    manifest = matches[0];
  } else {
    manifest = closestManifest(claim.sourcePath, allManifests);
  }
  if (!manifest) return void 0;
  return { path: manifest.path, hasScript: Object.hasOwn(manifest.scripts, claim.scriptName) };
}

// src/core/paths.ts
var import_node_path2 = __toESM(require("path"));
function normalizeCandidate(candidate) {
  const normalized = import_node_path2.default.posix.normalize(candidate).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) return void 0;
  return normalized;
}
function pathCandidates(claim) {
  const candidates = /* @__PURE__ */ new Set();
  const rootCandidate = normalizeCandidate(claim.targetPath);
  if (rootCandidate) candidates.add(rootCandidate);
  const sourceDirectory = import_node_path2.default.posix.dirname(claim.sourcePath);
  if (sourceDirectory !== ".") {
    const localCandidate = normalizeCandidate(import_node_path2.default.posix.join(sourceDirectory, claim.targetPath));
    if (localCandidate) candidates.add(localCandidate);
  }
  return [...candidates];
}

// src/core/engine.ts
function fingerprint(claim, manifestPath) {
  if (claim.ruleId === "AGC001") return `${claim.ruleId}:${claim.sourcePath}:${claim.targetPath}`;
  return `${claim.ruleId}:${claim.sourcePath}:${manifestPath ?? "unresolved"}:${claim.scriptName}:${claim.workspace ?? ""}`;
}
function stalePathFinding(claim, checkedPaths, renameHint) {
  return {
    ruleId: "AGC001",
    severity: "error",
    sourcePath: claim.sourcePath,
    line: claim.line,
    rawText: claim.rawText,
    message: "Repository path referenced by coding-agent instructions does not exist.",
    remediation: "Update the instruction reference or restore the path.",
    fingerprint: fingerprint(claim),
    renameHint,
    evidence: [
      { label: "referenced path", value: claim.targetPath },
      ...checkedPaths.length > 1 ? [{ label: "checked paths", value: checkedPaths.join(", ") }] : [],
      ...renameHint ? [{ label: "git rename hint", value: renameHint }] : []
    ]
  };
}
function staleScriptFinding(claim, manifestPath) {
  return {
    ruleId: "AGC002",
    severity: "error",
    sourcePath: claim.sourcePath,
    line: claim.line,
    rawText: claim.rawText,
    message: "Package script referenced by coding-agent instructions does not exist.",
    remediation: "Update the instruction command to an available package script.",
    fingerprint: fingerprint(claim, manifestPath),
    evidence: [
      { label: "package manager", value: claim.packageManager },
      { label: "script", value: claim.scriptName },
      { label: "manifest", value: manifestPath }
    ]
  };
}
async function evaluate(view, renameMap = /* @__PURE__ */ new Map()) {
  const sources = await discoverInstructionSources(view);
  const claims = sources.flatMap(extractClaims);
  const findings = [];
  const validFingerprints = /* @__PURE__ */ new Set();
  let skippedClaims = 0;
  for (const claim of claims) {
    if (claim.ruleId === "AGC001") {
      const candidates = pathCandidates(claim);
      const resolves = await Promise.all(candidates.map((candidate) => view.exists(candidate)));
      if (!resolves.some(Boolean)) {
        const renameHint = candidates.map((candidate) => renameMap.get(candidate)).find(Boolean);
        findings.push(stalePathFinding(claim, candidates, renameHint));
      } else {
        validFingerprints.add(fingerprint(claim));
      }
      continue;
    }
    const resolved = await resolvePackageManifest(view, claim);
    if (!resolved) {
      skippedClaims += 1;
      continue;
    }
    if (!resolved.hasScript) {
      findings.push(staleScriptFinding(claim, resolved.path));
    } else {
      validFingerprints.add(fingerprint(claim, resolved.path));
    }
  }
  return { findings, validFingerprints: [...validFingerprints], skippedClaims };
}
function classify(base, head) {
  const baseByFingerprint = new Map(base.findings.map((finding) => [finding.fingerprint, finding]));
  const headByFingerprint = new Map(head.findings.map((finding) => [finding.fingerprint, finding]));
  const baseValid = new Set(base.validFingerprints);
  return {
    newFindings: head.findings.filter((finding) => !baseByFingerprint.has(finding.fingerprint) && baseValid.has(finding.fingerprint)),
    unprovenFindings: head.findings.filter((finding) => !baseByFingerprint.has(finding.fingerprint) && !baseValid.has(finding.fingerprint)),
    existingFindings: head.findings.filter((finding) => baseByFingerprint.has(finding.fingerprint)),
    fixedFindings: base.findings.filter((finding) => !headByFingerprint.has(finding.fingerprint))
  };
}
async function checkCurrent(cwd, ref = "HEAD") {
  const view = new GitRepoView(cwd, ref);
  const resolvedRef = await view.resolveRef();
  const result = await evaluate(new GitRepoView(cwd, resolvedRef));
  return {
    mode: "check",
    ref: resolvedRef,
    findings: result.findings,
    skippedClaims: result.skippedClaims
  };
}
async function checkPullRequest(cwd, base, head) {
  const baseView = new GitRepoView(cwd, base);
  const headView = new GitRepoView(cwd, head);
  const [resolvedBase, resolvedHead] = await Promise.all([baseView.resolveRef(), headView.resolveRef()]);
  const renameMap = await renameHints(cwd, resolvedBase, resolvedHead);
  const [baseResult, headResult] = await Promise.all([
    evaluate(new GitRepoView(cwd, resolvedBase)),
    evaluate(new GitRepoView(cwd, resolvedHead), renameMap)
  ]);
  const groups = classify(baseResult, headResult);
  return {
    mode: "pr-check",
    base: resolvedBase,
    head: resolvedHead,
    ...groups,
    skippedClaims: { base: baseResult.skippedClaims, head: headResult.skippedClaims }
  };
}

// src/reporters/console.ts
function renderFinding(finding) {
  const evidence = finding.evidence.map((item) => `  ${item.label}: ${item.value}`).join("\n");
  const renameHint = finding.renameHint ? `
  possible rename: ${finding.renameHint}` : "";
  return [
    `${finding.ruleId} ${finding.sourcePath}:${finding.line}`,
    `  ${finding.message}`,
    evidence,
    renameHint,
    `  suggested action: ${finding.remediation}`
  ].filter(Boolean).join("\n");
}
function renderGroup(label, findings) {
  if (findings.length === 0) return `${label}: none`;
  return `${label}: ${findings.length}
${findings.map(renderFinding).join("\n\n")}`;
}
function renderConsole(result) {
  if (result.mode === "check") {
    return [
      `Agent Groundcheck \u2014 current state (${result.ref})`,
      renderGroup("findings", result.findings),
      `skipped ambiguous claims: ${result.skippedClaims}`
    ].join("\n\n");
  }
  return [
    `Agent Groundcheck \u2014 PR drift (${result.base.slice(0, 12)} \u2192 ${result.head.slice(0, 12)})`,
    renderGroup("new blocking findings", result.newFindings),
    renderGroup("unproven non-blocking findings", result.unprovenFindings),
    renderGroup("existing non-blocking debt", result.existingFindings),
    renderGroup("fixed findings", result.fixedFindings),
    `skipped ambiguous claims: base ${result.skippedClaims.base}, head ${result.skippedClaims.head}`
  ].join("\n\n");
}

// src/reporters/json.ts
function renderJson(result) {
  return `${JSON.stringify(result, null, 2)}
`;
}

// src/cli.ts
var HELP = `Agent Groundcheck v0.1.0

Usage:
  agent-groundcheck check [--ref <ref>] [--format text|json]
  agent-groundcheck pr-check --base <ref> --head <ref> [--format text|json]

Commands:
  check       Report high-confidence stale instruction claims at one revision.
  pr-check    Classify new, existing, and fixed instruction drift between revisions.

Exit codes:
  0  no blocking findings
  1  blocking findings
  2  invalid invocation or runtime error
`;
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    values[key] = value;
    index += 1;
  }
  const format = values.format ?? "text";
  if (format !== "text" && format !== "json") throw new Error("--format must be text or json");
  return {
    command,
    base: values.base,
    head: values.head,
    ref: values.ref,
    format,
    cwd: import_node_path3.default.resolve(values.cwd ?? import_node_process.default.cwd())
  };
}
function hasBlockingFindings(result) {
  return result.mode === "check" ? result.findings.length > 0 : result.newFindings.length > 0;
}
function printResult(result, format) {
  import_node_process.default.stdout.write(format === "json" ? renderJson(result) : `${renderConsole(result)}
`);
}
async function runCli(argv = import_node_process.default.argv.slice(2)) {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  if (normalizedArgv.length === 0 || normalizedArgv[0] === "--help" || normalizedArgv[0] === "-h") {
    import_node_process.default.stdout.write(HELP);
    return 0;
  }
  const args = parseArgs(normalizedArgv);
  let result;
  if (args.command === "check") {
    result = await checkCurrent(args.cwd, args.ref ?? "HEAD");
  } else if (args.command === "pr-check") {
    if (!args.base || !args.head) throw new Error("pr-check requires --base <ref> and --head <ref>");
    result = await checkPullRequest(args.cwd, args.base, args.head);
  } else {
    throw new Error(`Unknown command: ${args.command ?? ""}`);
  }
  printResult(result, args.format);
  return hasBlockingFindings(result) ? 1 : 0;
}
if (require.main === module) {
  runCli().then(
    (exitCode) => {
      import_node_process.default.exitCode = exitCode;
    },
    (error) => {
      import_node_process.default.stderr.write(`agent-groundcheck: ${error instanceof Error ? error.message : String(error)}
`);
      import_node_process.default.exitCode = 2;
    }
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runCli
});
//# sourceMappingURL=cli.js.map