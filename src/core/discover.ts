import { GitRepoView } from "./git";
import type { InstructionKind, InstructionSource } from "./types";

const IGNORED_SEGMENTS = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor"
]);

function instructionKind(path: string): InstructionKind | undefined {
  if (path.endsWith("/AGENTS.md") || path === "AGENTS.md") return "agents";
  if (path.endsWith("/CLAUDE.md") || path === "CLAUDE.md") return "claude";
  if (path.endsWith("/GEMINI.md") || path === "GEMINI.md") return "gemini";
  if (path === ".github/copilot-instructions.md") return "copilot";
  return undefined;
}

function isIgnored(path: string): boolean {
  return path.split("/").some((segment) => IGNORED_SEGMENTS.has(segment));
}

export async function discoverInstructionSources(view: GitRepoView): Promise<InstructionSource[]> {
  const files = await view.listFiles();
  const candidates = files.filter((path) => !isIgnored(path) && instructionKind(path));
  const sources: InstructionSource[] = [];

  for (const path of candidates) {
    const content = await view.readText(path);
    const kind = instructionKind(path);
    if (content !== null && kind) sources.push({ path, kind, content });
  }

  return sources;
}
