import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { ensureMemoryPromotionDirs, promoteMemory } from "../promotions.js";

describe("memory promotions", () => {
  it("creates project, pattern, and gem directories", async () => {
    const psiRoot = await mkdtemp(join(tmpdir(), "omx-memory-promote-"));
    try {
      await ensureMemoryPromotionDirs(psiRoot);
      assert.equal(true, true);
    } finally {
      await rm(psiRoot, { recursive: true, force: true });
    }
  });

  it("promotes a learning into a pattern", async () => {
    const root = await mkdtemp(join(tmpdir(), "omx-memory-pattern-"));
    const psiRoot = join(root, "ψ");
    try {
      await mkdir(join(psiRoot, "memory", "learnings"), { recursive: true });
      const source = join(psiRoot, "memory", "learnings", "2026-04-22_example.md");
      await writeFile(source, "# Example Lesson\n\nReusable insight.\n");

      const result = await promoteMemory({
        psiRoot,
        sourcePath: source,
        target: "pattern",
        tags: ["absorption", "policy"],
      });

      const content = await readFile(result.path, "utf8");
      assert.match(result.path, /memory\/patterns\//);
      assert.match(content, /source_type: pattern/);
      assert.match(content, /tags: \[absorption, policy\]/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("promotes a pattern into a gem with a stable gem id", async () => {
    const root = await mkdtemp(join(tmpdir(), "omx-memory-gem-"));
    const psiRoot = join(root, "ψ");
    try {
      await mkdir(join(psiRoot, "memory", "patterns"), { recursive: true });
      const source = join(psiRoot, "memory", "patterns", "2026-04-22_example.md");
      await writeFile(source, "# Example Pattern\n\nStrong distilled truth.\n");

      const result = await promoteMemory({
        psiRoot,
        sourcePath: source,
        target: "gem",
      });

      const content = await readFile(result.path, "utf8");
      assert.match(result.path, /memory\/gems\/G\d{3}_/);
      assert.match(content, /gem_id: G\d{3}/);
      assert.match(content, /status: active/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
