import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { memoryPromoteCommand } from "../memory-promote.js";

describe("memoryPromoteCommand", () => {
  it("prints help when required args are missing", async () => {
    const out: string[] = [];
    await memoryPromoteCommand([], { stdout: (line) => out.push(line) });
    assert.match(out.join("\n"), /Usage: omx memory promote/);
  });

  it("promotes a learning into a pattern in ψ memory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "omx-memory-promote-cli-"));
    const out: string[] = [];
    try {
      await mkdir(join(cwd, "ψ", "memory", "learnings"), { recursive: true });
      await writeFile(
        join(cwd, "ψ", "memory", "learnings", "2026-04-22_example.md"),
        "# Example\n\nImportant lesson.\n",
      );

      await memoryPromoteCommand(
        [
          "ψ/memory/learnings/2026-04-22_example.md",
          "--to",
          "pattern",
          "--tag",
          "absorption",
          "--json",
        ],
        { cwd, stdout: (line) => out.push(line) },
      );

      const result = JSON.parse(out.pop() ?? "{}") as { success?: boolean; path?: string };
      assert.equal(result.success, true);
      assert.match(result.path ?? "", /ψ\/memory\/patterns\//);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
