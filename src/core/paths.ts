import path from "node:path";
import type { PathReferenceClaim } from "./types";

function normalizeCandidate(candidate: string): string | undefined {
  const normalized = path.posix.normalize(candidate).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) return undefined;
  return normalized;
}

/**
 * Instruction files commonly use repository-root paths, but nested guidance also
 * uses paths relative to the directory containing that guidance. Check both
 * deterministic interpretations and prefer a false negative to a noisy finding.
 */
export function pathCandidates(claim: PathReferenceClaim): string[] {
  const candidates = new Set<string>();
  const rootCandidate = normalizeCandidate(claim.targetPath);
  if (rootCandidate) candidates.add(rootCandidate);

  const sourceDirectory = path.posix.dirname(claim.sourcePath);
  if (sourceDirectory !== ".") {
    const localCandidate = normalizeCandidate(path.posix.join(sourceDirectory, claim.targetPath));
    if (localCandidate) candidates.add(localCandidate);
  }

  return [...candidates];
}
