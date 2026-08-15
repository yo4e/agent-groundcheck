import path from "node:path";
import process from "node:process";
import { checkCurrent, checkPullRequest } from "./core/engine";
import { renderConsole } from "./reporters/console";
import { renderJson } from "./reporters/json";
import type { CheckResult } from "./core/types";

const HELP = `Agent Groundcheck v0.1.0

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

interface ParsedArgs {
  command?: string;
  base?: string;
  head?: string;
  ref?: string;
  format: "text" | "json";
  cwd: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const values: Record<string, string | undefined> = {};
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
    cwd: path.resolve(values.cwd ?? process.cwd())
  };
}

function hasBlockingFindings(result: CheckResult): boolean {
  return result.mode === "check" ? result.findings.length > 0 : result.newFindings.length > 0;
}

function printResult(result: CheckResult, format: "text" | "json"): void {
  process.stdout.write(format === "json" ? renderJson(result) : `${renderConsole(result)}\n`);
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  if (normalizedArgv.length === 0 || normalizedArgv[0] === "--help" || normalizedArgv[0] === "-h") {
    process.stdout.write(HELP);
    return 0;
  }

  const args = parseArgs(normalizedArgv);
  let result: CheckResult;
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
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      process.stderr.write(`agent-groundcheck: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    }
  );
}
