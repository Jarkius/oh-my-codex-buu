import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export type MemoryPromotionTarget = "project" | "pattern" | "gem";

export interface PromotionFrontmatter {
  project?: string;
  source_type?: string;
  promoted_from?: string;
  promoted_to?: string[];
  tags?: string[];
  confidence?: string;
  reusability?: string;
  gem_id?: string;
  status?: string;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "memory-item";
}

function parseFrontmatter(content: string): { frontmatter: PromotionFrontmatter; body: string } {
  if (!content.startsWith("---\n")) {
    return { frontmatter: {}, body: content };
  }
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) return { frontmatter: {}, body: content };

  const raw = content.slice(4, end).split("\n");
  const frontmatter: PromotionFrontmatter = {};
  for (const line of raw) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key as keyof PromotionFrontmatter] = value
        .slice(1, -1)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean) as never;
    } else {
      frontmatter[key as keyof PromotionFrontmatter] = value.replace(/^"(.*)"$/, "$1") as never;
    }
  }

  return {
    frontmatter,
    body: content.slice(end + 5),
  };
}

function serializeFrontmatter(frontmatter: PromotionFrontmatter): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(", ")}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

export function memoryProjectsDir(psiRoot: string): string {
  return join(psiRoot, "memory", "projects");
}

export function memoryPatternsDir(psiRoot: string): string {
  return join(psiRoot, "memory", "patterns");
}

export function memoryGemsDir(psiRoot: string): string {
  return join(psiRoot, "memory", "gems");
}

export async function ensureMemoryPromotionDirs(psiRoot: string): Promise<void> {
  await mkdir(memoryProjectsDir(psiRoot), { recursive: true });
  await mkdir(memoryPatternsDir(psiRoot), { recursive: true });
  await mkdir(memoryGemsDir(psiRoot), { recursive: true });
}

function gemPathFor(psiRoot: string, gemId: string, titleSlug: string): string {
  return join(memoryGemsDir(psiRoot), `${gemId}_${titleSlug}.md`);
}

function nextGemId(existingFiles: string[]): string {
  const max = existingFiles
    .map((file) => {
      const match = basename(file).match(/^G(\d{3,})_/i);
      return match ? Number.parseInt(match[1], 10) : 0;
    })
    .reduce((best, current) => Math.max(best, current), 0);
  return `G${String(max + 1).padStart(3, "0")}`;
}

function targetPath(
  psiRoot: string,
  target: MemoryPromotionTarget,
  projectSlug: string | undefined,
  sourcePath: string,
): string {
  const originalBase = basename(sourcePath).replace(/^\d{4}-\d{2}-\d{2}_/, "");
  const titleSlug = slugify(originalBase.replace(/\.md$/i, ""));

  if (target === "project") {
    if (!projectSlug) {
      throw new Error("Project promotion requires a project slug (for example github.com/owner/repo).");
    }
    return join(memoryProjectsDir(psiRoot), projectSlug, `${todayDate()}_${titleSlug}.md`);
  }

  if (target === "pattern") {
    return join(memoryPatternsDir(psiRoot), `${todayDate()}_${titleSlug}.md`);
  }

  const gemsDir = memoryGemsDir(psiRoot);
  const existing = existsSync(gemsDir)
    ? readdirSync(gemsDir).map((file) => join(gemsDir, file))
    : [];
  return gemPathFor(psiRoot, nextGemId(existing), titleSlug);
}

export interface PromoteMemoryOptions {
  psiRoot: string;
  sourcePath: string;
  target: MemoryPromotionTarget;
  projectSlug?: string;
  tags?: string[];
}

export async function promoteMemory(options: PromoteMemoryOptions): Promise<{
  path: string;
  frontmatter: PromotionFrontmatter;
}> {
  await ensureMemoryPromotionDirs(options.psiRoot);

  const sourceContent = await readFile(options.sourcePath, "utf-8");
  const parsed = parseFrontmatter(sourceContent);
  const path = targetPath(
    options.psiRoot,
    options.target,
    options.projectSlug,
    options.sourcePath,
  );

  await mkdir(dirname(path), { recursive: true });

  const nextFrontmatter: PromotionFrontmatter = {
    ...parsed.frontmatter,
    ...(options.projectSlug ? { project: options.projectSlug } : {}),
    source_type: options.target,
    promoted_from: options.sourcePath,
    promoted_to: Array.from(
      new Set([...(parsed.frontmatter.promoted_to ?? []), options.target]),
    ),
    ...(options.tags && options.tags.length > 0 ? { tags: options.tags } : {}),
    ...(options.target === "pattern"
      ? { reusability: parsed.frontmatter.reusability ?? "high" }
      : {}),
    ...(options.target === "gem"
      ? {
          gem_id: basename(path).split("_")[0],
          status: "active",
          confidence: parsed.frontmatter.confidence ?? "high",
        }
      : {}),
  };

  const promotedContent =
    `${serializeFrontmatter(nextFrontmatter)}\n${parsed.body.trim()}\n`;
  await writeFile(path, promotedContent, "utf-8");

  return { path, frontmatter: nextFrontmatter };
}
