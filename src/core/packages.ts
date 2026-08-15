import path from "node:path";
import { GitRepoView } from "./git";
import type { PackageScriptClaim } from "./types";

interface PackageManifest {
  path: string;
  name?: string;
  scripts: Record<string, string>;
}

function parseManifest(pathname: string, content: string): PackageManifest | undefined {
  try {
    const value = JSON.parse(content) as { name?: unknown; scripts?: unknown };
    const scripts = typeof value.scripts === "object" && value.scripts !== null
      ? Object.fromEntries(
          Object.entries(value.scripts as Record<string, unknown>).filter(
            ([, command]) => typeof command === "string"
          )
        ) as Record<string, string>
      : {};
    return {
      path: pathname,
      name: typeof value.name === "string" ? value.name : undefined,
      scripts
    };
  } catch {
    return undefined;
  }
}

async function manifests(view: GitRepoView): Promise<PackageManifest[]> {
  const files = (await view.listFiles()).filter((pathname) => path.posix.basename(pathname) === "package.json");
  const parsed = await Promise.all(
    files.map(async (pathname) => {
      const content = await view.readText(pathname);
      return content === null ? undefined : parseManifest(pathname, content);
    })
  );
  return parsed.filter((manifest): manifest is PackageManifest => Boolean(manifest));
}

function closestManifest(sourcePath: string, allManifests: PackageManifest[]): PackageManifest | undefined {
  const sourceDirectory = path.posix.dirname(sourcePath);
  const candidates = allManifests
    .filter((manifest) => {
      const manifestDirectory = path.posix.dirname(manifest.path);
      return sourceDirectory === manifestDirectory || sourceDirectory.startsWith(`${manifestDirectory}/`);
    })
    .sort((left, right) => path.posix.dirname(right.path).length - path.posix.dirname(left.path).length);
  return candidates[0];
}

export async function resolvePackageManifest(
  view: GitRepoView,
  claim: PackageScriptClaim
): Promise<{ path: string; hasScript: boolean } | undefined> {
  const allManifests = await manifests(view);
  let manifest: PackageManifest | undefined;

  if (claim.workspace) {
    const matches = allManifests.filter((candidate) => candidate.name === claim.workspace);
    if (matches.length !== 1) return undefined;
    manifest = matches[0];
  } else {
    manifest = closestManifest(claim.sourcePath, allManifests);
  }

  if (!manifest) return undefined;
  return { path: manifest.path, hasScript: Object.hasOwn(manifest.scripts, claim.scriptName) };
}
