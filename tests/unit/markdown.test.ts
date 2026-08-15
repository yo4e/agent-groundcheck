import { describe, expect, it } from "vitest";
import { extractClaims } from "../../src/core/markdown";

describe("extractClaims", () => {
  it("extracts repository paths from inline code, fenced code, and relative links", () => {
    const claims = extractClaims({
      path: "AGENTS.md",
      kind: "agents",
      content: [
        "Read `docs/architecture.md`.",
        "[Build guide](./docs/build.md#commands)",
        "```sh",
        "pnpm run test:e2e",
        "```"
      ].join("\n")
    });

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "AGC001", targetPath: "docs/architecture.md", line: 1 }),
        expect.objectContaining({ ruleId: "AGC001", targetPath: "docs/build.md", line: 2 }),
        expect.objectContaining({ ruleId: "AGC002", packageManager: "pnpm", scriptName: "test:e2e", line: 4 })
      ])
    );
  });

  it("rejects URLs, globs, placeholders, and ordinary unstructured prose", () => {
    const claims = extractClaims({
      path: "CLAUDE.md",
      kind: "claude",
      content: [
        "Visit `https://example.com/docs`.",
        "Read `docs/**/*.md`.",
        "Open `${DOC_PATH}`.",
        "Use `@/components/ui/button` as an import alias.",
        "Send `text/plain` for plain text responses.",
        "The src directory contains source code."
      ].join("\n")
    });

    expect(claims).toEqual([]);
  });

  it("extracts only explicit run-form package scripts", () => {
    const claims = extractClaims({
      path: "AGENTS.md",
      kind: "agents",
      content: "Use `npm install`, `yarn add typescript`, `pnpm drizzle-kit push`, `pnpm lint`, and `npm run verify`."
    });

    expect(claims).toEqual([
      expect.objectContaining({ ruleId: "AGC002", packageManager: "npm", scriptName: "verify" })
    ]);
  });
});
