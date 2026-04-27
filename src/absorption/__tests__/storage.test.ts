import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildAbsorptionPackage,
  generateMatrixSeed,
  readAbsorptionRegistry,
  syncActiveFormProjectMemory,
  writeActiveAbsorptionForm,
  writeAbsorptionRegistry,
} from "../storage.js";
import { activateForm } from "../forms.js";

describe("absorption storage", () => {
  it("generates a GSD matrix seed from repo signals", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-matrix-seed-"));
    try {
      await writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          name: "oh-my-codex-buu",
          description: "Buu-style absorption layer built on top of oh-my-codex for Codex-native orchestration",
        }),
      );
      await writeFile(
        join(cwd, "README.md"),
        "# Demo\n\nAbsorb external workflows without erasing provenance.\n",
      );
      await mkdir(join(cwd, "src", "cli"), { recursive: true });
      await mkdir(join(cwd, "src", "absorption"), { recursive: true });
      await mkdir(join(cwd, "src", "adapt"), { recursive: true });

      const seed = await generateMatrixSeed(cwd);
      assert.equal(seed.project.name, "oh-my-codex-buu");
      assert.ok(seed.gsd.goals.some((goal) => /Codex-native orchestration/i.test(goal)));
      assert.ok(seed.gsd.systems.some((system) => /CLI runtime/i.test(system)));
      assert.ok(seed.suggestedCocoons.some((cocoon) => cocoon.id === "omx-core"));
      assert.ok(seed.suggestedCocoons.some((cocoon) => cocoon.id === "buu-absorption"));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("writes and reads a persisted registry", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorption-registry-"));
    try {
      await writeAbsorptionRegistry(cwd, {
        cocoons: [
          {
            id: "omx-core",
            name: "OMX Core Runtime",
            kind: "repo",
            status: "quarantined",
            capabilities: [],
            provenance: {
              source: "local:test",
              absorbedAt: new Date().toISOString(),
              digestMethod: "cell-gate",
            },
          },
        ],
      });
      const registry = await readAbsorptionRegistry(cwd);
      assert.equal(registry.cocoons.length, 1);
      assert.equal(registry.cocoons[0]?.id, "omx-core");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("builds a reloaded package with active form and project memory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorption-package-"));
    try {
      await writeFile(
        join(cwd, "package.json"),
        JSON.stringify({
          name: "oh-my-codex-buu",
          description: "Buu-style absorption layer built on top of oh-my-codex for Codex-native orchestration",
        }),
      );
      await writeFile(join(cwd, "README.md"), "# Demo\n\nAbsorb external workflows.\n");
      await mkdir(join(cwd, "src", "cli"), { recursive: true });
      await mkdir(join(cwd, "src", "absorption"), { recursive: true });
      const registry = {
        cocoons: [
          {
            id: "omx-core",
            name: "OMX Core Runtime",
            kind: "repo" as const,
            status: "quarantined" as const,
            capabilities: [
              {
                id: "operator-surface",
                name: "Operator surface",
                description: "CLI, hooks, HUD, and stateful runtime controls.",
                tags: ["cli"],
              },
            ],
            provenance: {
              source: "local:test",
              absorbedAt: new Date().toISOString(),
              digestMethod: "cell-gate" as const,
            },
          },
        ],
      };
      await writeAbsorptionRegistry(cwd, registry);
      await generateMatrixSeed(cwd);
      const form = await writeActiveAbsorptionForm(
        cwd,
        activateForm(registry, "awake-core", "Awake Core", ["omx-core"]),
      );
      await syncActiveFormProjectMemory(cwd, form);

      const pkg = await buildAbsorptionPackage(cwd, "reloaded");
      assert.equal(pkg.lane, "reloaded");
      assert.equal(pkg.activeForm?.id, "awake-core");
      assert.ok((pkg.wakeDirectives ?? []).length > 0);
      assert.ok((pkg.planningPolicy?.summary ?? "").length > 0);
      assert.ok((pkg.projectMemory?.directives ?? []).length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
