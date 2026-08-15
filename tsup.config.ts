import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/action.ts"],
  format: ["cjs"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  banner: {
    js: "#!/usr/bin/env node"
  }
});
