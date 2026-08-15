import { afterEach, describe, expect, it } from "vitest";
import { checkPullRequest } from "../../src/core/engine";
import { createTestRepository, type TestRepository } from "../helpers/git-repo";

const repositories: TestRepository[] = [];

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => repository.cleanup()));
});

async function repository(): Promise<TestRepository> {
  const value = await createTestRepository();
  repositories.push(value);
  return value;
}

describe("pr-check", () => {
  it("reports AGC001 when a previously valid instruction path is deleted", async () => {
    const repo = await repository();
    await repo.write("AGENTS.md", "Read `docs/architecture.md` before changing code.\n");
    await repo.write("docs/architecture.md", "# Architecture\n");
    const base = repo.commit("add instruction and path");
    await repo.remove("docs/architecture.md");
    const head = repo.commit("remove architecture document");

    const result = await checkPullRequest(repo.cwd, base, head);
    expect(result.mode).toBe("pr-check");
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0]).toMatchObject({ ruleId: "AGC001", sourcePath: "AGENTS.md", line: 1 });
    expect(result.existingFindings).toHaveLength(0);
  });

  it("resolves a nested instruction path relative to that instruction file", async () => {
    const repo = await repository();
    await repo.write("packages/docs/AGENTS.md", "Read `guides/release.md` before publishing.\n");
    await repo.write("packages/docs/guides/release.md", "# Release guide\n");
    const base = repo.commit("add nested release guidance");
    await repo.remove("packages/docs/guides/release.md");
    const head = repo.commit("remove nested release guide");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0]).toMatchObject({ ruleId: "AGC001", sourcePath: "packages/docs/AGENTS.md" });
    expect(result.newFindings[0].evidence).toContainEqual({
      label: "checked paths",
      value: "guides/release.md, packages/docs/guides/release.md"
    });
  });

  it("includes a rename hint without relying on rename inference for the finding", async () => {
    const repo = await repository();
    await repo.write("AGENTS.md", "Read `docs/architecture.md`.\n");
    await repo.write("docs/architecture.md", "# Stable content\n");
    const base = repo.commit("add architecture guide");
    await repo.move("docs/architecture.md", "docs/system-design.md");
    const head = repo.commit("rename architecture guide");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0].renameHint).toBe("docs/system-design.md");
  });

  it("keeps already stale paths as non-blocking existing debt", async () => {
    const repo = await repository();
    await repo.write("AGENTS.md", "Read `docs/missing.md`.\n");
    const base = repo.commit("add pre-existing stale instruction");
    await repo.write("src/unrelated.ts", "export const answer = 42;\n");
    const head = repo.commit("change unrelated code");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(0);
    expect(result.existingFindings).toHaveLength(1);
  });

  it("reports a newly added already-stale claim as unproven and non-blocking", async () => {
    const repo = await repository();
    await repo.write("README.md", "# Test repository\n");
    const base = repo.commit("add repository readme");
    await repo.write("AGENTS.md", "Read `docs/not-created.md` before changing code.\n");
    const head = repo.commit("add incomplete instruction");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(0);
    expect(result.unprovenFindings).toHaveLength(1);
    expect(result.existingFindings).toHaveLength(0);
  });

  it("does not report a path when the instruction is updated in the same rename", async () => {
    const repo = await repository();
    await repo.write("AGENTS.md", "Read `docs/architecture.md`.\n");
    await repo.write("docs/architecture.md", "# Architecture\n");
    const base = repo.commit("add architecture guide");
    await repo.move("docs/architecture.md", "docs/system-design.md");
    await repo.write("AGENTS.md", "Read `docs/system-design.md`.\n");
    const head = repo.commit("rename guide and update instruction");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(0);
    expect(result.existingFindings).toHaveLength(0);
  });

  it("reports AGC002 when a previously valid package script is removed", async () => {
    const repo = await repository();
    await repo.write("AGENTS.md", "Run `pnpm run test:e2e` before submitting.\n");
    await repo.write("package.json", JSON.stringify({ scripts: { "test:e2e": "node test.js" } }, null, 2));
    const base = repo.commit("add e2e script");
    await repo.write("package.json", JSON.stringify({ scripts: {} }, null, 2));
    const head = repo.commit("remove obsolete e2e script");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0]).toMatchObject({ ruleId: "AGC002" });
    expect(result.newFindings[0].evidence).toContainEqual({ label: "manifest", value: "package.json" });
  });

  it("does not report new drift for an unrelated code change", async () => {
    const repo = await repository();
    await repo.write("CLAUDE.md", "Use `docs/testing.md` for test guidance.\n");
    await repo.write("docs/testing.md", "# Tests\n");
    const base = repo.commit("add valid guidance");
    await repo.write("src/feature.ts", "export const feature = true;\n");
    const head = repo.commit("add unrelated feature");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(0);
    expect(result.existingFindings).toHaveLength(0);
  });

  it("resolves a script against the closest package manifest", async () => {
    const repo = await repository();
    await repo.write("package.json", JSON.stringify({ scripts: {} }, null, 2));
    await repo.write("packages/web/AGENTS.md", "Run `npm run verify`.\n");
    await repo.write("packages/web/package.json", JSON.stringify({ scripts: { verify: "node verify.js" } }, null, 2));
    const base = repo.commit("add workspace verification command");
    await repo.write("packages/web/package.json", JSON.stringify({ scripts: {} }, null, 2));
    const head = repo.commit("remove workspace verification script");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0].evidence).toContainEqual({ label: "manifest", value: "packages/web/package.json" });
  });

  it("resolves a cd-prefixed script against that working directory", async () => {
    const repo = await repository();
    await repo.write("package.json", JSON.stringify({ scripts: {} }, null, 2));
    await repo.write("AGENTS.md", "Run `cd clients/web && npm run dev` during local development.\n");
    await repo.write("clients/web/package.json", JSON.stringify({ scripts: { dev: "vite" } }, null, 2));
    const base = repo.commit("add nested development command");
    await repo.write("clients/web/package.json", JSON.stringify({ scripts: {} }, null, 2));
    const head = repo.commit("remove nested development script");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0]).toMatchObject({ ruleId: "AGC002" });
    expect(result.newFindings[0].evidence).toContainEqual({ label: "manifest", value: "clients/web/package.json" });
  });

  it("falls back to the root manifest for a nested instruction without a nearer package", async () => {
    const repo = await repository();
    await repo.write("package.json", JSON.stringify({ scripts: { verify: "node verify.js" } }, null, 2));
    await repo.write("packages/docs/AGENTS.md", "Run `pnpm run verify` before publishing.\n");
    const base = repo.commit("add root verification instruction");
    await repo.write("package.json", JSON.stringify({ scripts: {} }, null, 2));
    const head = repo.commit("remove root verification script");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(1);
    expect(result.newFindings[0].evidence).toContainEqual({ label: "manifest", value: "package.json" });
  });

  it("fails safe and non-blocking when a requested workspace is ambiguous", async () => {
    const repo = await repository();
    await repo.write("AGENTS.md", "Run `pnpm run verify --workspace shared`.\n");
    await repo.write("packages/a/package.json", JSON.stringify({ name: "shared", scripts: { verify: "node a.js" } }, null, 2));
    await repo.write("packages/b/package.json", JSON.stringify({ name: "shared", scripts: { verify: "node b.js" } }, null, 2));
    const base = repo.commit("add ambiguous duplicate workspaces");
    await repo.write("src/change.ts", "export {};\n");
    const head = repo.commit("make unrelated change");

    const result = await checkPullRequest(repo.cwd, base, head);
    if (result.mode !== "pr-check") return;
    expect(result.newFindings).toHaveLength(0);
    expect(result.existingFindings).toHaveLength(0);
    expect(result.skippedClaims.head).toBe(1);
  });
});
