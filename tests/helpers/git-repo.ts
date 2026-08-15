import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface TestRepository {
  cwd: string;
  base: string;
  head: string;
  write(relativePath: string, content: string): Promise<void>;
  remove(relativePath: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  commit(message: string): string;
  cleanup(): Promise<void>;
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export async function createTestRepository(): Promise<TestRepository> {
  const cwd = await mkdtemp(path.join(tmpdir(), "agent-groundcheck-"));
  git(cwd, ["init", "--initial-branch=main"]);
  git(cwd, ["config", "user.email", "tests@example.invalid"]);
  git(cwd, ["config", "user.name", "Agent Groundcheck Tests"]);

  const write = async (relativePath: string, content: string): Promise<void> => {
    const filename = path.join(cwd, relativePath);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, content, "utf8");
  };

  const remove = async (relativePath: string): Promise<void> => {
    await rm(path.join(cwd, relativePath), { force: true, recursive: true });
  };

  const move = async (from: string, to: string): Promise<void> => {
    await mkdir(path.dirname(path.join(cwd, to)), { recursive: true });
    git(cwd, ["mv", from, to]);
  };

  const commit = (message: string): string => {
    git(cwd, ["add", "--all"]);
    git(cwd, ["commit", "-m", message]);
    return git(cwd, ["rev-parse", "HEAD"]);
  };

  return {
    cwd,
    base: "",
    head: "",
    write,
    remove,
    move,
    commit,
    cleanup: async () => rm(cwd, { force: true, recursive: true })
  };
}
