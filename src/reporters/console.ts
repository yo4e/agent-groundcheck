import type { CheckResult, Finding } from "../core/types";

function renderFinding(finding: Finding): string {
  const evidence = finding.evidence.map((item) => `  ${item.label}: ${item.value}`).join("\n");
  const renameHint = finding.renameHint ? `\n  possible rename: ${finding.renameHint}` : "";
  return [
    `${finding.ruleId} ${finding.sourcePath}:${finding.line}`,
    `  ${finding.message}`,
    evidence,
    renameHint,
    `  suggested action: ${finding.remediation}`
  ]
    .filter(Boolean)
    .join("\n");
}

function renderGroup(label: string, findings: Finding[]): string {
  if (findings.length === 0) return `${label}: none`;
  return `${label}: ${findings.length}\n${findings.map(renderFinding).join("\n\n")}`;
}

export function renderConsole(result: CheckResult): string {
  if (result.mode === "check") {
    return [
      `Agent Groundcheck — current state (${result.ref})`,
      renderGroup("findings", result.findings),
      `skipped ambiguous claims: ${result.skippedClaims}`
    ].join("\n\n");
  }

  return [
    `Agent Groundcheck — PR drift (${result.base.slice(0, 12)} → ${result.head.slice(0, 12)})`,
    renderGroup("new blocking findings", result.newFindings),
    renderGroup("existing non-blocking debt", result.existingFindings),
    renderGroup("fixed findings", result.fixedFindings),
    `skipped ambiguous claims: base ${result.skippedClaims.base}, head ${result.skippedClaims.head}`
  ].join("\n\n");
}

export function renderSummary(result: CheckResult): string {
  if (result.mode === "check") {
    return `Current-state findings: ${result.findings.length}; skipped ambiguous claims: ${result.skippedClaims}.`;
  }
  return [
    `New blocking findings: ${result.newFindings.length}.`,
    `Existing non-blocking debt: ${result.existingFindings.length}.`,
    `Fixed findings: ${result.fixedFindings.length}.`,
    `Skipped ambiguous claims: base ${result.skippedClaims.base}, head ${result.skippedClaims.head}.`
  ].join(" ");
}
