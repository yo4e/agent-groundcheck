import { discoverInstructionSources } from "./discover";
import { GitRepoView, renameHints } from "./git";
import { extractClaims } from "./markdown";
import { resolvePackageManifest } from "./packages";
import type {
  Claim,
  CurrentCheckResult,
  EvaluationResult,
  Finding,
  PackageScriptClaim,
  PathReferenceClaim,
  PrCheckResult
} from "./types";

function fingerprint(claim: Claim, manifestPath?: string): string {
  if (claim.ruleId === "AGC001") return `${claim.ruleId}:${claim.sourcePath}:${claim.targetPath}`;
  return `${claim.ruleId}:${claim.sourcePath}:${manifestPath ?? "unresolved"}:${claim.scriptName}:${claim.workspace ?? ""}`;
}

function stalePathFinding(claim: PathReferenceClaim, renameHint?: string): Finding {
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
      ...(renameHint ? [{ label: "git rename hint", value: renameHint }] : [])
    ]
  };
}

function staleScriptFinding(claim: PackageScriptClaim, manifestPath: string): Finding {
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

async function evaluate(view: GitRepoView, renameMap = new Map<string, string>()): Promise<EvaluationResult> {
  const sources = await discoverInstructionSources(view);
  const claims = sources.flatMap(extractClaims);
  const findings: Finding[] = [];
  let skippedClaims = 0;

  for (const claim of claims) {
    if (claim.ruleId === "AGC001") {
      if (!(await view.exists(claim.targetPath))) {
        findings.push(stalePathFinding(claim, renameMap.get(claim.targetPath)));
      }
      continue;
    }

    const resolved = await resolvePackageManifest(view, claim);
    if (!resolved) {
      skippedClaims += 1;
      continue;
    }
    if (!resolved.hasScript) findings.push(staleScriptFinding(claim, resolved.path));
  }

  return { findings, skippedClaims };
}

function classify(base: Finding[], head: Finding[]) {
  const baseByFingerprint = new Map(base.map((finding) => [finding.fingerprint, finding]));
  const headByFingerprint = new Map(head.map((finding) => [finding.fingerprint, finding]));
  return {
    newFindings: head.filter((finding) => !baseByFingerprint.has(finding.fingerprint)),
    existingFindings: head.filter((finding) => baseByFingerprint.has(finding.fingerprint)),
    fixedFindings: base.filter((finding) => !headByFingerprint.has(finding.fingerprint))
  };
}

export async function checkCurrent(cwd: string, ref = "HEAD"): Promise<CurrentCheckResult> {
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

export async function checkPullRequest(cwd: string, base: string, head: string): Promise<PrCheckResult> {
  const baseView = new GitRepoView(cwd, base);
  const headView = new GitRepoView(cwd, head);
  const [resolvedBase, resolvedHead] = await Promise.all([baseView.resolveRef(), headView.resolveRef()]);
  const renameMap = await renameHints(cwd, resolvedBase, resolvedHead);
  const [baseResult, headResult] = await Promise.all([
    evaluate(new GitRepoView(cwd, resolvedBase)),
    evaluate(new GitRepoView(cwd, resolvedHead), renameMap)
  ]);
  const groups = classify(baseResult.findings, headResult.findings);
  return {
    mode: "pr-check",
    base: resolvedBase,
    head: resolvedHead,
    ...groups,
    skippedClaims: { base: baseResult.skippedClaims, head: headResult.skippedClaims }
  };
}
