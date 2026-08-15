export type RuleId = "AGC001" | "AGC002";

export type InstructionKind =
  | "agents"
  | "claude"
  | "gemini"
  | "copilot";

export interface InstructionSource {
  path: string;
  kind: InstructionKind;
  content: string;
}

export interface ClaimBase {
  ruleId: RuleId;
  sourcePath: string;
  line: number;
  rawText: string;
}

export interface PathReferenceClaim extends ClaimBase {
  ruleId: "AGC001";
  targetPath: string;
}

export interface PackageScriptClaim extends ClaimBase {
  ruleId: "AGC002";
  packageManager: "npm" | "pnpm" | "yarn";
  scriptName: string;
  workspace?: string;
}

export type Claim = PathReferenceClaim | PackageScriptClaim;

export interface Evidence {
  label: string;
  value: string;
}

export interface Finding {
  ruleId: RuleId;
  severity: "error";
  sourcePath: string;
  line: number;
  rawText: string;
  message: string;
  remediation: string;
  fingerprint: string;
  evidence: Evidence[];
  renameHint?: string;
}

export interface EvaluationResult {
  findings: Finding[];
  validFingerprints: string[];
  skippedClaims: number;
}

export interface PrCheckResult {
  mode: "pr-check";
  base: string;
  head: string;
  newFindings: Finding[];
  unprovenFindings: Finding[];
  existingFindings: Finding[];
  fixedFindings: Finding[];
  skippedClaims: {
    base: number;
    head: number;
  };
}

export interface CurrentCheckResult {
  mode: "check";
  ref: string;
  findings: Finding[];
  skippedClaims: number;
}

export type CheckResult = PrCheckResult | CurrentCheckResult;
