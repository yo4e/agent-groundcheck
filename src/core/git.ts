import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_TEXT_BYTES = 1_000_000;

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_TEXT_BYTES + 16_384
    });
    return stdout;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Git command failed: git ${args.join(" ")}\n${detail}`);
  }
}

export class GitRepoView {
  constructor(
    readonly cwd: string,
    readonly ref: string
  ) {}

  async resolveRef(): Promise<string> {
    return (await git(this.cwd, ["rev-parse", "--verify", this.ref])).trim();
  }

  async listFiles(): Promise<string[]> {
    const output = await git(this.cwd, ["ls-tree", "-r", "--name-only", this.ref]);
    return output.split("\n").filter(Boolean);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await git(this.cwd, ["cat-file", "-e", `${this.ref}:${path}`]);
      const type = (await git(this.cwd, ["cat-file", "-t", `${this.ref}:${path}`])).trim();
      return type === "blob" || type === "tree";
    } catch {
      return false;
    }
  }

  async readText(path: string): Promise<string | null> {
    try {
      const type = (await git(this.cwd, ["cat-file", "-t", `${this.ref}:${path}`])).trim();
      if (type !== "blob") return null;
      const size = Number((await git(this.cwd, ["cat-file", "-s", `${this.ref}:${path}`])).trim());
      if (!Number.isFinite(size) || size > MAX_TEXT_BYTES) return null;
      return await git(this.cwd, ["show", `${this.ref}:${path}`]);
    } catch {
      return null;
    }
  }
}

export async function renameHints(cwd: string, base: string, head: string): Promise<Map<string, string>> {
  const output = await git(cwd, ["diff", "--name-status", "-M", base, head]);
  const hints = new Map<string, string>();
  for (const line of output.split("\n")) {
    const parts = line.split("\t");
    if (parts.length === 3 && parts[0].startsWith("R")) hints.set(parts[1], parts[2]);
  }
  return hints;
}

export async function repositoryRoot(cwd: string): Promise<string> {
  return (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();
}
