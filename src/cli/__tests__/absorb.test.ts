import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { absorbCommand } from "../absorb.js";

describe("absorbCommand", () => {
  it("prints help when called without args", async () => {
    const out: string[] = [];
    await absorbCommand([], {
      stdout: (line) => out.push(line),
    });
    assert.match(out.join("\n"), /Usage: omx absorb <list\|seed-matrix\|seed-apply\|digest\|reject\|form\|activate\|current\|package\|apply\|import>/i);
  });

  it("generates a matrix seed as compact JSON", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorb-seed-"));
    const out: string[] = [];
    try {
      await absorbCommand(["seed-matrix", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      assert.equal(out.length, 1);
      assert.match(out[0] ?? "", /^\{"matrixSeedPath":/);
      assert.match(out[0] ?? "", /"gsd":\{/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("applies a written seed and allows digesting imported cocoons", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorb-apply-"));
    const out: string[] = [];
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

      await absorbCommand(["seed-matrix", "--write"], {
        cwd,
        stdout: () => undefined,
      });
      await absorbCommand(["seed-apply", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      const imported = JSON.parse(out.pop() ?? "{}") as { imported?: string[] };
      assert.ok((imported.imported ?? []).includes("omx-core"));

      await absorbCommand(["digest", "omx-core", "--note", "approved", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      const digested = JSON.parse(out.pop() ?? "{}") as { status?: string; provenance?: { notes?: string } };
      assert.equal(digested.status, "digested");
      assert.match(digested.provenance?.notes ?? "", /approved/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("activates a form and exposes it via current state", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorb-active-"));
    const out: string[] = [];
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

      await absorbCommand(["seed-matrix", "--write"], { cwd, stdout: () => undefined });
      await absorbCommand(["seed-apply"], { cwd, stdout: () => undefined });
      await absorbCommand(["activate", "awake-core", "omx-core", "buu-absorption", "--name", "Awake Core", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      const activated = JSON.parse(out.pop() ?? "{}") as {
        activeForm?: { name?: string; cocoonIds?: string[] };
        wakeDirectives?: string[];
        projectMemory?: { directives?: Array<{ directive?: string }>; notes?: Array<{ content?: string }> };
      };
      assert.equal(activated.activeForm?.name, "Awake Core");
      assert.deepEqual(activated.activeForm?.cocoonIds, ["omx-core", "buu-absorption"]);
      assert.ok((activated.wakeDirectives ?? []).length > 0);
      assert.ok(
        (activated.projectMemory?.directives ?? []).some((entry) =>
          /operator-facing runtime surface/i.test(entry.directive ?? ""),
        ),
      );
      assert.ok(
        (activated.projectMemory?.notes ?? []).some((entry) =>
          /Active absorption form: Awake Core/.test(entry.content ?? ""),
        ),
      );

      await absorbCommand(["current", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      const current = JSON.parse(out.pop() ?? "{}") as {
        activeForm?: { id?: string };
        wakeDirectives?: string[];
      };
      assert.equal(current.activeForm?.id, "awake-core");
      assert.ok(
        (current.wakeDirectives ?? []).some((directive) =>
          /operator-facing runtime surface/i.test(directive),
        ),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("exports reloaded package lane output", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorb-package-"));
    const out: string[] = [];
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

      await absorbCommand(["seed-matrix", "--write"], { cwd, stdout: () => undefined });
      await absorbCommand(["seed-apply"], { cwd, stdout: () => undefined });
      await absorbCommand(["activate", "awake-core", "omx-core", "--name", "Awake Core"], {
        cwd,
        stdout: () => undefined,
      });
      await absorbCommand(["package", "reloaded", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      const pkg = JSON.parse(out.pop() ?? "{}") as {
        lane?: string;
        wakeDirectives?: string[];
        projectMemory?: { directives?: Array<{ directive?: string }> };
      };
      assert.equal(pkg.lane, "reloaded");
      assert.ok((pkg.wakeDirectives ?? []).length > 0);
      assert.ok((pkg.projectMemory?.directives ?? []).length > 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("applies a named profile to activate a durable form", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-absorb-apply-profile-"));
    const out: string[] = [];
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

      await absorbCommand(["seed-matrix", "--write"], { cwd, stdout: () => undefined });
      await absorbCommand(["seed-apply"], { cwd, stdout: () => undefined });
      await absorbCommand(["apply", "matrix-core", "--json"], {
        cwd,
        stdout: (line) => out.push(line),
      });
      const applied = JSON.parse(out.pop() ?? "{}") as {
        profile?: string;
        activeForm?: { id?: string; cocoonIds?: string[] };
      };
      assert.equal(applied.profile, "matrix-core");
      assert.equal(applied.activeForm?.id, "matrix-core");
      assert.deepEqual(applied.activeForm?.cocoonIds, ["omx-core", "buu-absorption"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("imports a reloaded package into local absorption state", async () => {
    const sourceCwd = await mkdtemp(join(tmpdir(), "omx-absorb-import-src-"));
    const targetCwd = await mkdtemp(join(tmpdir(), "omx-absorb-import-dst-"));
    const out: string[] = [];
    try {
      for (const cwd of [sourceCwd, targetCwd]) {
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
      }

      await absorbCommand(["seed-matrix", "--write"], { cwd: sourceCwd, stdout: () => undefined });
      await absorbCommand(["seed-apply"], { cwd: sourceCwd, stdout: () => undefined });
      await absorbCommand(["apply", "matrix-core"], { cwd: sourceCwd, stdout: () => undefined });
      await absorbCommand(["package", "reloaded", "--write"], { cwd: sourceCwd, stdout: () => undefined });

      const packagePath = join(sourceCwd, ".omx", "absorption", "packages", "reloaded.json");
      await absorbCommand(["import", packagePath, "--json"], {
        cwd: targetCwd,
        stdout: (line) => out.push(line),
      });
      const imported = JSON.parse(out.pop() ?? "{}") as {
        importedLane?: string;
        importedCocoons?: string[];
        activeForm?: { id?: string };
      };
      assert.equal(imported.importedLane, "reloaded");
      assert.ok((imported.importedCocoons ?? []).includes("omx-core"));
      assert.equal(imported.activeForm?.id, "matrix-core");
    } finally {
      await rm(sourceCwd, { recursive: true, force: true });
      await rm(targetCwd, { recursive: true, force: true });
    }
  });
});
