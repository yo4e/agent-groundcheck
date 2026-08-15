import { fromMarkdown } from "mdast-util-from-markdown";
import type { Claim, InstructionSource, PackageScriptClaim, PathReferenceClaim } from "./types";

type MarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  position?: { start?: { line?: number } };
  children?: MarkdownNode[];
};

const SCRIPT_PATTERN = /\b(npm|pnpm|yarn)\s+run\s+([A-Za-z0-9][A-Za-z0-9:_-]*)(?:\s+--workspace(?:=|\s+)([A-Za-z0-9@/_-]+))?/g;
const MIME_TYPE_PREFIXES = new Set(["application", "audio", "font", "image", "message", "model", "multipart", "text", "video"]);

function lineFor(node: MarkdownNode, fallback: number): number {
  return node.position?.start?.line ?? fallback;
}

function normalizePath(candidate: string): string | undefined {
  let value = candidate.trim().replace(/^[`'"(]+|[`'"),.;:]+$/g, "");
  if (!value || value === "." || value === "..") return undefined;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/|~\/|#|@)/i.test(value)) return undefined;
  value = value.split(/[?#]/, 1)[0];
  if (!value) return undefined;
  if (value.includes("${") || value.includes("{{") || /[*?[]/.test(value)) return undefined;
  const [firstSegment, secondSegment, ...remainingSegments] = value.split("/");
  if (remainingSegments.length === 0 && MIME_TYPE_PREFIXES.has(firstSegment) && Boolean(secondSegment)) return undefined;
  value = value.replace(/^\.\//, "");
  if (value.startsWith("../") || value.includes("/../")) return undefined;
  if (!value.includes("/") && !/^[A-Za-z0-9_.-]+\.(?:md|mdx|json|ya?ml|toml|[cm]?[jt]sx?|py|sh)$/i.test(value)) {
    return undefined;
  }
  return value.replace(/\/+/g, "/").replace(/^\/+/, "");
}

function extractPathClaim(source: InstructionSource, rawText: string, line: number): PathReferenceClaim | undefined {
  const targetPath = normalizePath(rawText);
  if (!targetPath) return undefined;
  return {
    ruleId: "AGC001",
    sourcePath: source.path,
    line,
    rawText,
    targetPath
  };
}

function extractScriptClaims(source: InstructionSource, rawText: string, line: number): PackageScriptClaim[] {
  const claims: PackageScriptClaim[] = [];
  for (const match of rawText.matchAll(SCRIPT_PATTERN)) {
    const packageManager = match[1] as PackageScriptClaim["packageManager"];
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

function claimsFromText(source: InstructionSource, rawText: string, line: number): Claim[] {
  const claims: Claim[] = [...extractScriptClaims(source, rawText, line)];
  const pathClaim = extractPathClaim(source, rawText, line);
  if (pathClaim) claims.push(pathClaim);
  return claims;
}

function visit(node: MarkdownNode, callback: (node: MarkdownNode) => void): void {
  callback(node);
  for (const child of node.children ?? []) visit(child, callback);
}

export function extractClaims(source: InstructionSource): Claim[] {
  const root = fromMarkdown(source.content) as unknown as MarkdownNode;
  const claims: Claim[] = [];

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
