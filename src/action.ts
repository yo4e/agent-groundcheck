import { readFile } from "node:fs/promises";
import process from "node:process";
import * as core from "@actions/core";
import { checkPullRequest } from "./core/engine";
import { renderConsole, renderSummary } from "./reporters/console";

interface PullRequestEvent {
  pull_request?: {
    base?: { sha?: string };
    head?: { sha?: string };
  };
}

async function eventRefs(): Promise<{ base: string; head: string } | undefined> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return undefined;
  try {
    const event = JSON.parse(await readFile(eventPath, "utf8")) as PullRequestEvent;
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    return base && head ? { base, head } : undefined;
  } catch {
    return undefined;
  }
}

async function run(): Promise<void> {
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

  const result = await checkPullRequest(process.env.GITHUB_WORKSPACE ?? process.cwd(), base, head);
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

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
