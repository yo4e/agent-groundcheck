import { discoverInstructionSources } from "./discover";
import { GitRepoView, renameHints } from "./git";
import { extractClaims } from "./markdown";
import { resolvePackageManifest } from "./packages";
import { pathCandidates } from "./paths";
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

function stalePathFinding(claim: PathReferenceClaim, checkedPaths: string[], renameHint?: string): Finding {
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
      ...(checkedPaths.length > 1 ? [{ label: "checked paths", value: checkedPaths.join(", ") }] : []),
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
  const validFingerprints = new Set<string>();
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

function classify(base: EvaluationResult, head: EvaluationResult) {
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
  const groups = classify(baseResult, headResult);
  return {
    mode: "pr-check",
    base: resolvedBase,
    head: resolvedHead,
    ...groups,
    skippedClaims: { base: baseResult.skippedClaims, head: headResult.skippedClaims }
  };
}
