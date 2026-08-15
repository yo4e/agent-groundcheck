#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/action.ts
var import_promises = require("fs/promises");
var import_node_process = __toESM(require("process"));
var core = __toESM(require("@actions/core"));

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
function instructionKind(path3) {
  if (path3.endsWith("/AGENTS.md") || path3 === "AGENTS.md") return "agents";
  if (path3.endsWith("/CLAUDE.md") || path3 === "CLAUDE.md") return "claude";
  if (path3.endsWith("/GEMINI.md") || path3 === "GEMINI.md") return "gemini";
  if (path3 === ".github/copilot-instructions.md") return "copilot";
  return void 0;
}
function isIgnored(path3) {
  return path3.split("/").some((segment) => IGNORED_SEGMENTS.has(segment));
}
async function discoverInstructionSources(view) {
  const files = await view.listFiles();
  const candidates = files.filter((path3) => !isIgnored(path3) && instructionKind(path3));
  const sources = [];
  for (const path3 of candidates) {
    const content = await view.readText(path3);
    const kind = instructionKind(path3);
    if (content !== null && kind) sources.push({ path: path3, kind, content });
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
  } catch (error2) {
    const detail = error2 instanceof Error ? error2.message : String(error2);
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
  async exists(path3) {
    try {
      await git(this.cwd, ["cat-file", "-e", `${this.ref}:${path3}`]);
      const type = (await git(this.cwd, ["cat-file", "-t", `${this.ref}:${path3}`])).trim();
      return type === "blob" || type === "tree";
    } catch {
      return false;
    }
  }
  async readText(path3) {
    try {
      const type = (await git(this.cwd, ["cat-file", "-t", `${this.ref}:${path3}`])).trim();
      if (type !== "blob") return null;
      const size = Number((await git(this.cwd, ["cat-file", "-s", `${this.ref}:${path3}`])).trim());
      if (!Number.isFinite(size) || size > MAX_TEXT_BYTES) return null;
      return await git(this.cwd, ["show", `${this.ref}:${path3}`]);
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
function renderSummary(result) {
  if (result.mode === "check") {
    return `Current-state findings: ${result.findings.length}; skipped ambiguous claims: ${result.skippedClaims}.`;
  }
  return [
    `New blocking findings: ${result.newFindings.length}.`,
    `Unproven non-blocking findings: ${result.unprovenFindings.length}.`,
    `Existing non-blocking debt: ${result.existingFindings.length}.`,
    `Fixed findings: ${result.fixedFindings.length}.`,
    `Skipped ambiguous claims: base ${result.skippedClaims.base}, head ${result.skippedClaims.head}.`
  ].join(" ");
}

// src/action.ts
async function eventRefs() {
  const eventPath = import_node_process.default.env.GITHUB_EVENT_PATH;
  if (!eventPath) return void 0;
  try {
    const event = JSON.parse(await (0, import_promises.readFile)(eventPath, "utf8"));
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    return base && head ? { base, head } : void 0;
  } catch {
    return void 0;
  }
}
async function run() {
  const fromInput = {
    base: core.getInput("base").trim(),
    head: core.getInput("head").trim()
  };
  const fromEvent = await eventRefs();
  const base = fromInput.base || fromEvent?.base;
  const head = fromInput.head || fromEvent?.head;
  if (!base || !head) {
    throw new Error("Could not resolve base/head revisions. Provide action inputs or run on a pull_request event.");
  }
  const result = await checkPullRequest(import_node_process.default.env.GITHUB_WORKSPACE ?? import_node_process.default.cwd(), base, head);
  await core.summary.addHeading("Agent Groundcheck").addCodeBlock(renderConsole(result)).write();
  for (const finding of result.newFindings) {
    core.error(`${finding.ruleId}: ${finding.message} ${finding.remediation}`, {
      file: finding.sourcePath,
      startLine: finding.line,
      title: finding.ruleId
    });
  }
  core.info(renderSummary(result));
  if (result.newFindings.length > 0) core.setFailed(`${result.newFindings.length} newly introduced instruction-drift finding(s).`);
}
run().catch((error2) => {
  core.setFailed(error2 instanceof Error ? error2.message : String(error2));
});
//# sourceMappingURL=action.js.map