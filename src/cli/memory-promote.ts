import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  ensureMemoryPromotionDirs,
  promoteMemory,
  type MemoryPromotionTarget,
} from "../memory/promotions.js";

const HELP = [
  "Usage: omx memory promote <source-file> --to <project|pattern|gem> [--project <slug>] [--tag <tag>] [--json]",
  "",
  "Examples:",
  "  omx memory promote ψ/memory/learnings/2026-04-22_example.md --to pattern --json",
  "  omx memory promote ψ/memory/learnings/2026-04-22_example.md --to project --project github.com/Jarkius/oh-my-codex-buu --json",
  "  omx memory promote ψ/memory/patterns/2026-04-22_example.md --to gem --tag absorption --tag policy --json",
].join("\n");

function parseArgs(args: string[]): {
  sourceFile?: string;
  target?: MemoryPromotionTarget;
  projectSlug?: string;
  tags: string[];
  json: boolean;
  help: boolean;
} {
  const tags: string[] = [];
  let json = false;
  let help = false;
  let sourceFile: string | undefined;
  let target: MemoryPromotionTarget | undefined;
  let projectSlug: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token) continue;
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token === "--help" || token === "-h" || token === "help") {
      help = true;
      continue;
    }
    if (token === "--to") {
      target = args[i + 1] as MemoryPromotionTarget | undefined;
      i += 1;
      continue;
    }
    if (token === "--project") {
      projectSlug = args[i + 1];
      i += 1;
      continue;
    }
    if (token === "--tag") {
      const tag = args[i + 1];
      if (tag) tags.push(tag);
      i += 1;
      continue;
    }
    if (!sourceFile) {
      sourceFile = token;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return { sourceFile, target, projectSlug, tags, json, help };
}

export interface MemoryPromoteCommandDependencies {
  cwd?: string;
  stdout?: (line: string) => void;
}

export async function memoryPromoteCommand(
  args: string[],
  deps: MemoryPromoteCommandDependencies = {},
): Promise<void> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? ((line: string) => console.log(line));
  const parsed = parseArgs(args);

  if (parsed.help || !parsed.sourceFile || !parsed.target) {
    stdout(HELP);
    return;
  }

  const psiRoot = join(cwd, "ψ");
  await ensureMemoryPromotionDirs(psiRoot);

  const sourcePath = parsed.sourceFile.startsWith("/")
    ? parsed.sourceFile
    : join(cwd, parsed.sourceFile);
  if (!existsSync(sourcePath)) {
    throw new Error(`Memory source not found: ${sourcePath}`);
  }

  const result = await promoteMemory({
    psiRoot,
    sourcePath,
    target: parsed.target,
    projectSlug: parsed.projectSlug,
    tags: parsed.tags,
  });

  const payload = {
    success: true,
    path: result.path,
    frontmatter: result.frontmatter,
  };

  stdout(JSON.stringify(payload, null, parsed.json ? 0 : 2));
}
