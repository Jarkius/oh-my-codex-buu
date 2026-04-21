import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function runOmx(cwd: string, argv: string[]) {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(testDir, "..", "..", "..");
  const omxBin = join(repoRoot, "dist", "cli", "omx.js");
  return spawnSync(process.execPath, [omxBin, ...argv], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      OMX_AUTO_UPDATE: "0",
      OMX_NOTIFY_FALLBACK: "0",
      OMX_HOOK_DERIVED_SIGNALS: "0",
    },
  });
}

describe("omx absorb help", () => {
  it("documents absorb in top-level help and routes absorb-local help output", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorb-help-"));
    try {
      const mainHelp = runOmx(cwd, ["--help"]);
      assert.equal(mainHelp.status, 0, mainHelp.stderr || mainHelp.stdout);
      assert.match(mainHelp.stdout, /omx absorb\s+Manage absorption registry, seed matrix, and fused form previews/i);

      const absorbHelp = runOmx(cwd, ["absorb", "--help"]);
      assert.equal(absorbHelp.status, 0, absorbHelp.stderr || absorbHelp.stdout);
      assert.match(absorbHelp.stdout, /Usage: omx absorb <list\|seed-matrix\|seed-apply\|digest\|reject\|form\|activate\|current\|package\|apply\|import>/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
