#!/usr/bin/env node
/* eslint-disable no-undef */
/* global process */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function runCheck(repositoryDirectory, base, head) {
  const args = [join(ROOT, "dist", "cli.js"), "pr-check", "--cwd", repositoryDirectory, "--base", base, "--head", head, "--format", "json"];
  try {
    return { output: execFileSync("node", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).trim(), exitCode: 0 };
  } catch (error) {
    return { output: error?.stdout?.toString().trim() ?? "", exitCode: error?.status ?? 1 };
  }
}

function classify(result) {
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
  const inputPath = requiredArgument("--input");
  const outputPath = requiredArgument("--output");
  const workdir = requiredArgument("--workdir");
  const records = readFileSync(inputPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const replayed = records.map((record) => {
    if (record.recordType !== "comparison") return record;
    const repositoryDirectory = join(workdir, record.repository.replace("/", "__"));
    const { output, exitCode } = runCheck(repositoryDirectory, record.base, record.head);
    if (!output) return { ...record, status: "tool-error", replayExitCode: exitCode };
    return { ...record, ...classify(JSON.parse(output)), replayExitCode: exitCode };
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${replayed.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const comparisons = replayed.filter((record) => record.recordType === "comparison");
  console.log(JSON.stringify({
    comparisons: comparisons.length,
    candidateTruePositives: comparisons.filter((record) => record.status === "candidate-true-positive").length,
    unproven: comparisons.filter((record) => record.status === "unproven").length,
    correctlyClean: comparisons.filter((record) => record.status === "correctly-clean").length,
    toolErrors: comparisons.filter((record) => record.status === "tool-error").length,
    outputPath
  }, null, 2));
}

main();
