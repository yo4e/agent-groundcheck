#!/usr/bin/env node
/* eslint-disable no-control-regex, no-undef */
/* global process */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = process.cwd();
const DEFAULT_OUTPUT = join(ROOT, "research", "corpus", "data", "scan.ndjson");
const DEFAULT_SEEDS = join(ROOT, "research", "corpus", "data", "repositories.ndjson");
const DEFAULT_WORKDIR = "/tmp/agent-groundcheck-corpus";
const CURATED_SEEDS = [
  { repository: "promptfoo/promptfoo", formats: ["AGENTS.md", "CLAUDE.md"], discoveryQueries: ["curated: prior-public-PR-evidence"] },
  { repository: "CherryHQ/cherry-studio", formats: ["AGENTS.md", "CLAUDE.md"], discoveryQueries: ["curated: prior-public-PR-evidence"] },
  { repository: "google/adk-python", formats: ["AGENTS.md"], discoveryQueries: ["curated: prior-research-corpus"] },
  { repository: "medama-io/medama", formats: ["AGENTS.md"], discoveryQueries: ["curated: prior-dogfooding"] },
  { repository: "Nutlope/make-comics", formats: ["AGENTS.md"], discoveryQueries: ["curated: prior-dogfooding"] },
  { repository: "lajarre/pi-vim", formats: ["AGENTS.md"], discoveryQueries: ["curated: prior-dogfooding"] },
  { repository: "quickemu-project/quickemu", formats: ["AGENTS.md"], discoveryQueries: ["curated: prior-research-corpus"] },
  { repository: "javascript-obfuscator/javascript-obfuscator", formats: ["CLAUDE.md"], discoveryQueries: ["curated: prior-research-corpus"] },
  { repository: "SuperClaude-Org/SuperClaude_Framework", formats: ["AGENTS.md", "CLAUDE.md"], discoveryQueries: ["curated: prior-research-corpus"] },
  { repository: "inkline/inkline", formats: ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"], discoveryQueries: ["curated: prior-research-corpus"] },
  { repository: "openai/codex", formats: ["AGENTS.md"], discoveryQueries: ["curated: format-reference"] },
  { repository: "modelcontextprotocol/servers", formats: ["AGENTS.md", "CLAUDE.md"], discoveryQueries: ["curated: format-reference"] }
];

const DEFAULT_QUERIES = [
  "filename:AGENTS.md extension:md language:TypeScript",
  "filename:AGENTS.md extension:md language:Python",
  "filename:AGENTS.md extension:md language:Go",
  "filename:AGENTS.md extension:md language:Rust",
  "filename:AGENTS.md extension:md language:Java",
  "filename:CLAUDE.md extension:md language:TypeScript",
  "filename:CLAUDE.md extension:md language:Python",
  "filename:CLAUDE.md extension:md language:Go",
  "filename:GEMINI.md extension:md",
  "filename:copilot-instructions.md extension:md"
];

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

function numberArgument(name, fallback) {
  const value = Number(argument(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function command(commandName, args, options = {}) {
  try {
    return execFileSync(commandName, args, {
      cwd: options.cwd ?? ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024
    }).trim();
  } catch (error) {
    if (options.allowFailure) return undefined;
    const stderr = error?.stderr?.toString().trim() ?? String(error);
    throw new Error(`${commandName} ${args.join(" ")} failed: ${stderr}`);
  }
}

function commandResult(commandName, args, options = {}) {
  try {
    return {
      output: execFileSync(commandName, args, {
        cwd: options.cwd ?? ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 16 * 1024 * 1024
      }).trim(),
      status: 0
    };
  } catch (error) {
    return {
      output: error?.stdout?.toString().trim() ?? "",
      status: error?.status ?? 1
    };
  }
}

function git(repositoryDirectory, args, options = {}) {
  return command("git", args, { ...options, cwd: repositoryDirectory });
}

function writeNdjson(pathname, records) {
  mkdirSync(join(pathname, ".."), { recursive: true });
  writeFileSync(pathname, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
}

function parseJson(output, context) {
  const clean = output
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`Could not parse JSON for ${context}.`);
  }
}

function metadata(repository) {
  const output = command("gh", ["api", "--method", "GET", `/repos/${repository}`], { allowFailure: true });
  if (!output) return undefined;
  return parseJson(output, repository);
}

function supportedInstructionPath(pathname) {
  const leaf = basename(pathname);
  return leaf === "AGENTS.md" || leaf === "CLAUDE.md" || leaf === "GEMINI.md" || pathname === ".github/copilot-instructions.md";
}

function formatCategory(repository) {
  if (repository.formats.some((format) => format.endsWith("AGENTS.md"))) return "agents";
  if (repository.formats.some((format) => format.endsWith("CLAUDE.md"))) return "claude";
  if (repository.formats.some((format) => format.endsWith("GEMINI.md"))) return "gemini";
  return "copilot";
}

function discovery() {
  const repositories = new Map(CURATED_SEEDS.map((candidate) => [candidate.repository, candidate]));
  for (const query of DEFAULT_QUERIES) {
    let accepted = 0;
    for (let page = 1; page <= 3 && accepted < 12; page += 1) {
      const output = command("gh", [
        "api",
        "-H",
        "Accept: application/vnd.github+json",
        "--method",
        "GET",
        "/search/code",
        "-f",
        `q=${query}`,
        "-f",
        "per_page=100",
        "-f",
        `page=${page}`
      ]);
      const response = parseJson(output, `${query} page ${page}`);
      for (const item of (response.items ?? []).filter((candidate) => supportedInstructionPath(candidate.path))) {
        const source = item.repository;
        if (!source) continue;
        const existing = repositories.get(source.full_name);
        const formats = new Set(existing?.formats ?? []);
        formats.add(item.path);
        repositories.set(source.full_name, {
          repository: source.full_name,
          htmlUrl: source.html_url,
          formats: [...formats].sort(),
          discoveryQueries: [...new Set([...(existing?.discoveryQueries ?? []), query])].sort()
        });
        accepted += 1;
        if (accepted === 12) break;
      }
    }
  }
  const hydrated = [];
  for (const candidate of repositories.values()) {
    const detail = metadata(candidate.repository);
    if (!detail || detail.fork || detail.archived || detail.size > 500_000) continue;
    hydrated.push({
      ...candidate,
      defaultBranch: detail.default_branch,
      sizeKiB: detail.size,
      stars: detail.stargazers_count,
      language: detail.language ?? null
    });
  }
  return hydrated;
}

function selectDiverse(repositories, limit) {
  const curatedOrder = new Map(CURATED_SEEDS.map((candidate, index) => [candidate.repository, index]));
  const selected = repositories
    .filter((repository) => curatedOrder.has(repository.repository))
    .sort((left, right) => curatedOrder.get(left.repository) - curatedOrder.get(right.repository))
    .slice(0, limit);
  const selectedNames = new Set(selected.map((repository) => repository.repository));
  const groups = new Map();
  for (const repository of repositories.filter((candidate) => !selectedNames.has(candidate.repository))) {
    const category = formatCategory(repository);
    const group = groups.get(category) ?? [];
    group.push(repository);
    groups.set(category, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => right.stars - left.stars || left.sizeKiB - right.sizeKiB || left.repository.localeCompare(right.repository));
  }

  const categories = [...groups.keys()].sort();
  while (selected.length < limit) {
    let selectedOne = false;
    for (const category of categories) {
      const repository = groups.get(category)?.shift();
      if (!repository) continue;
      selected.push(repository);
      selectedOne = true;
      if (selected.length === limit) break;
    }
    if (!selectedOne) break;
  }
  return selected;
}

function clone(repository, workdir, depth, fullClone) {
  const directory = join(workdir, repository.repository.replace("/", "__"));
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
  mkdirSync(workdir, { recursive: true });
  const cloneArguments = ["repo", "clone", repository.repository, directory, "--", "--no-checkout", `--depth=${depth}`];
  if (!fullClone) cloneArguments.push("--filter=blob:none");
  const output = command("gh", cloneArguments, { allowFailure: true });
  if (output === undefined) return undefined;
  return directory;
}

function instructionFiles(repositoryDirectory, ref) {
  const files = git(repositoryDirectory, ["ls-tree", "-r", "--name-only", ref], { allowFailure: true });
  if (files === undefined) return [];
  return files.split("\n").filter(supportedInstructionPath);
}

function structuralCommits(repositoryDirectory, depth, cap) {
  const commits = git(repositoryDirectory, ["rev-list", "--first-parent", `--max-count=${depth}`, "HEAD"], { allowFailure: true });
  if (!commits) return [];
  const candidates = [];
  for (const head of commits.split("\n")) {
    const base = git(repositoryDirectory, ["rev-parse", `${head}^`], { allowFailure: true });
    if (!base) continue;
    const changes = git(repositoryDirectory, ["diff", "--name-status", "-M", base, head], { allowFailure: true });
    if (!changes) continue;
    const changedPaths = changes.split("\n").filter(Boolean);
    const highSignal = changedPaths.some((line) => /^(D|R\d*)\t/.test(line) || (/^M\t/.test(line) && (line.endsWith("package.json") || /(?:^|\t)(?:AGENTS|CLAUDE|GEMINI)\.md$/.test(line) || line.endsWith(".github/copilot-instructions.md"))));
    if (!highSignal) continue;
    candidates.push({ base, head, changedPaths });
    if (candidates.length === cap) break;
  }
  return candidates;
}

function replay(repositoryDirectory, base, head) {
  const { output } = commandResult("node", [join(ROOT, "dist", "cli.js"), "pr-check", "--cwd", repositoryDirectory, "--base", base, "--head", head, "--format", "json"]);
  if (!output) return { status: "tool-error" };
  const result = parseJson(output, `${base}..${head}`);
  const newFindings = result.newFindings ?? [];
  const unprovenFindings = result.unprovenFindings ?? [];
  return {
    status: newFindings.length > 0 ? "candidate-true-positive" : unprovenFindings.length > 0 ? "unproven" : "correctly-clean",
    newFindings,
    unprovenFindings,
    existingFindings: result.existingFindings ?? [],
    fixedFindings: result.fixedFindings ?? [],
    skippedClaims: result.skippedClaims
  };
}

function main() {
  const repositoryLimit = numberArgument("--repositories", 24);
  const historyDepth = numberArgument("--history-depth", 240);
  const comparisonsPerRepository = numberArgument("--comparisons-per-repository", 24);
  const outputPath = argument("--output", DEFAULT_OUTPUT);
  const seedsPath = argument("--seeds", DEFAULT_SEEDS);
  const workdir = argument("--workdir", DEFAULT_WORKDIR);
  const refreshSeeds = process.argv.includes("--discover");
  const discoveryOnly = process.argv.includes("--discovery-only");
  const fullClone = process.argv.includes("--full-clone");

  let seeds;
  if (refreshSeeds || !existsSync(seedsPath)) {
    seeds = selectDiverse(discovery(), repositoryLimit);
    writeNdjson(seedsPath, seeds);
  } else {
    seeds = readFileSync(seedsPath, "utf8").trim().split("\n").filter(Boolean).map((line) => parseJson(line, seedsPath));
  }

  if (discoveryOnly) {
    console.log(JSON.stringify({ repositories: seeds.length, seedsPath }, null, 2));
    return;
  }

  const records = [];
  for (const repository of seeds.slice(0, repositoryLimit)) {
    const directory = clone(repository, workdir, historyDepth + 1, fullClone);
    if (!directory) {
      records.push({ ...repository, recordType: "repository", status: "clone-failed" });
      continue;
    }
    const head = git(directory, ["rev-parse", "HEAD"], { allowFailure: true });
    const files = head ? instructionFiles(directory, head) : [];
    const candidates = structuralCommits(directory, historyDepth, comparisonsPerRepository);
    records.push({
      ...repository,
      recordType: "repository",
      scannedHead: head ?? null,
      discoveredInstructionFiles: files,
      candidateComparisons: candidates.length,
      status: candidates.length > 0 ? "scanned" : "no-high-signal-history"
    });
    for (const candidate of candidates) {
      records.push({
        ...repository,
        recordType: "comparison",
        ...candidate,
        ...replay(directory, candidate.base, candidate.head)
      });
    }
  }
  writeNdjson(outputPath, records);
  const comparisons = records.filter((record) => record.recordType === "comparison");
  const summary = {
    repositoriesRequested: repositoryLimit,
    repositoriesRecorded: records.filter((record) => record.recordType === "repository").length,
    comparisons: comparisons.length,
    candidateTruePositives: comparisons.filter((record) => record.status === "candidate-true-positive").length,
    unproven: comparisons.filter((record) => record.status === "unproven").length,
    correctlyClean: comparisons.filter((record) => record.status === "correctly-clean").length,
    toolErrors: comparisons.filter((record) => record.status === "tool-error").length,
    outputPath,
    fullClone
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
