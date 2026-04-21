import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createCocoon } from "../absorption/cocoon.js";
import { activateForm } from "../absorption/forms.js";
import { digestCocoon, rejectCocoon } from "../absorption/quarantine.js";
import { findCocoon, registerCocoon, type AbsorptionRegistry } from "../absorption/registry.js";
import {
  activeAbsorptionFormPath,
  type AbsorptionPackage,
  absorptionPackagePath,
  absorptionMatrixSeedPath,
  absorptionRegistryPath,
  buildAbsorptionPackage,
  deriveWakeDirectives,
  generateMatrixSeed,
  readActiveAbsorptionForm,
  readAbsorptionRegistry,
  readMatrixSeed,
  type AbsorptionPackageLane,
  syncActiveFormProjectMemory,
  writeActiveAbsorptionForm,
  writeAbsorptionPackage,
  writeAbsorptionRegistry,
  writeMatrixSeed,
} from "../absorption/storage.js";

const HELP = [
  "Usage: omx absorb <list|seed-matrix|seed-apply|digest|reject|form|activate|current|package|apply|import> [args] [--json] [--write]",
  "",
  "Subcommands:",
  "  list                Show the persisted absorption registry",
  "  seed-matrix         Generate a GSD matrix seed (goals, systems, differentiators)",
  "  seed-apply          Import suggested cocoons from the saved matrix seed into the registry",
  "  digest <id>         Mark a cocoon as digested",
  "  reject <id>         Mark a cocoon as rejected",
  "  form <id> <cocoons...>",
  "                      Preview a fused form from persisted cocoon ids",
  "  activate <id> <cocoons...>",
  "                      Persist an active fused form for runtime overlay injection",
  "  current             Show the current matrix seed + active form state",
  "  package <source|seed|reloaded>",
  "                      Export canonical source, distributable seed, or awakened reloaded package",
  "  apply <profile>     Activate a named form profile from available cocoons",
  "  import <package>    Import a source/seed/reloaded package into the local absorption state",
  "",
  "Options:",
  "  --json              Emit compact machine-readable JSON",
  "  --write             Write seed-matrix output to .omx/absorption/matrix-seed.json",
  "  --note <text>       Optional note for digest/reject transitions",
  "  --name <text>       Optional display name for form output",
].join("\n");

type AbsorbSubcommand =
  | "list"
  | "seed-matrix"
  | "seed-apply"
  | "digest"
  | "reject"
  | "form"
  | "activate"
  | "current"
  | "package"
  | "apply"
  | "import";

function parseArgs(args: string[]): {
  subcommand: string | undefined;
  positional: string[];
  json: boolean;
  write: boolean;
  note?: string;
  name?: string;
  wantsHelp: boolean;
} {
  const positional: string[] = [];
  let json = false;
  let write = false;
  let wantsHelp = false;
  let note: string | undefined;
  let name: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--write") {
      write = true;
      continue;
    }
    if (arg === "--help" || arg === "-h" || arg === "help") {
      wantsHelp = true;
      continue;
    }
    if (arg === "--note") {
      note = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--name") {
      name = args[index + 1];
      index += 1;
      continue;
    }
    positional.push(arg);
  }

  const [subcommand, ...rest] = positional;
  return { subcommand, positional: rest, json, write, note, name, wantsHelp };
}

function render(value: unknown, json: boolean, stdout: (line: string) => void): void {
  stdout(JSON.stringify(value, null, json ? 0 : 2));
}

function assertKnownCocoon(registry: AbsorptionRegistry, cocoonId: string) {
  const cocoon = findCocoon(registry, cocoonId);
  if (!cocoon) {
    throw new Error(`Unknown cocoon: ${cocoonId}`);
  }
  return cocoon;
}

function assertSubcommand(subcommand: string | undefined): asserts subcommand is AbsorbSubcommand {
  if (!subcommand) {
    throw new Error(HELP);
  }
  if (!["list", "seed-matrix", "seed-apply", "digest", "reject", "form", "activate", "current", "package", "apply", "import"].includes(subcommand)) {
    throw new Error(`Unknown absorb subcommand: ${subcommand}`);
  }
}

function assertPackageLane(lane: string | undefined): asserts lane is AbsorptionPackageLane {
  if (!lane || !["source", "seed", "reloaded"].includes(lane)) {
    throw new Error("Usage: omx absorb package <source|seed|reloaded> [--json] [--write]");
  }
}

function resolveProfileCocoonIds(
  profile: string,
  registry: AbsorptionRegistry,
): { formId: string; name: string; cocoonIds: string[] } {
  const available = new Set(registry.cocoons.map((cocoon) => cocoon.id));
  const pick = (...ids: string[]) => ids.filter((id) => available.has(id));

  switch (profile) {
    case "matrix-core":
      return {
        formId: "matrix-core",
        name: "Matrix Core",
        cocoonIds: pick("omx-core", "buu-absorption"),
      };
    case "cell-gate":
      return {
        formId: "cell-gate",
        name: "Cell Gate",
        cocoonIds: pick("omx-core", "qwen-cell-gate"),
      };
    case "oracle-commander":
      return {
        formId: "oracle-commander",
        name: "Oracle Commander",
        cocoonIds: pick("omx-core", "buu-absorption", "qwen-cell-gate", "adapter-foundations"),
      };
    case "full-power":
      return {
        formId: "full-power",
        name: "Full Power",
        cocoonIds: registry.cocoons
          .filter((cocoon) => cocoon.status !== "rejected" && cocoon.status !== "ejected")
          .map((cocoon) => cocoon.id),
      };
    default:
      throw new Error(
        "Unknown absorb profile. Supported profiles: matrix-core, cell-gate, oracle-commander, full-power",
      );
  }
}

type ImportedProjectMemory = NonNullable<AbsorptionPackage["projectMemory"]>;
type ImportedNote = NonNullable<ImportedProjectMemory["notes"]>[number];
type ImportedDirective = NonNullable<ImportedProjectMemory["directives"]>[number];

async function mergeImportedProjectMemory(
  cwd: string,
  imported: AbsorptionPackage["projectMemory"] | undefined,
): Promise<Record<string, unknown> | null> {
  if (!imported) return null;

  const path = join(cwd, ".omx", "project-memory.json");
  let current: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      current = JSON.parse(await readFile(path, "utf-8")) as Record<string, unknown>;
    } catch {
      current = {};
    }
  }

  if (!current.techStack && imported.techStack) current.techStack = imported.techStack;
  if (!current.conventions && imported.conventions) current.conventions = imported.conventions;
  if (!current.build && imported.build) current.build = imported.build;

  const currentNotes = Array.isArray(current.notes)
    ? current.notes as ImportedNote[]
    : [];
  const importedNotes = Array.isArray(imported.notes)
    ? imported.notes as ImportedNote[]
    : [];
  const seenNotes = new Set(currentNotes.map((note) => String(note.content ?? "")));
  for (const note of importedNotes) {
    const content = String(note.content ?? "");
    if (!content || seenNotes.has(content)) continue;
    currentNotes.push(note);
    seenNotes.add(content);
  }
  current.notes = currentNotes;

  const currentDirectives = Array.isArray(current.directives)
    ? current.directives as ImportedDirective[]
    : [];
  const importedDirectives = Array.isArray(imported.directives)
    ? imported.directives as ImportedDirective[]
    : [];
  const seenDirectives = new Set(currentDirectives.map((directive) => String(directive.directive ?? "")));
  for (const directive of importedDirectives) {
    const text = String(directive.directive ?? "");
    if (!text || seenDirectives.has(text)) continue;
    currentDirectives.push(directive);
    seenDirectives.add(text);
  }
  current.directives = currentDirectives;

  await writeFile(path, `${JSON.stringify(current, null, 2)}\n`, "utf-8");
  return current;
}

export interface AbsorbCommandDependencies {
  cwd?: string;
  stdout?: (line: string) => void;
}

export async function absorbCommand(
  args: string[],
  deps: AbsorbCommandDependencies = {},
): Promise<void> {
  const cwd = deps.cwd ?? process.cwd();
  const stdout = deps.stdout ?? ((line: string) => console.log(line));
  const parsed = parseArgs(args);

  if (parsed.wantsHelp || !parsed.subcommand) {
    stdout(HELP);
    return;
  }

  assertSubcommand(parsed.subcommand);

  switch (parsed.subcommand) {
    case "list": {
      const registry = await readAbsorptionRegistry(cwd);
      render(
        {
          registryPath: absorptionRegistryPath(cwd),
          cocoons: registry.cocoons,
        },
        parsed.json,
        stdout,
      );
      return;
    }

    case "current": {
      const [seed, activeForm] = await Promise.all([
        readMatrixSeed(cwd),
        readActiveAbsorptionForm(cwd),
      ]);
      render(
        {
          matrixSeedPath: absorptionMatrixSeedPath(cwd),
          activeFormPath: activeAbsorptionFormPath(cwd),
          seed,
          activeForm,
          wakeDirectives: deriveWakeDirectives(activeForm),
        },
        parsed.json,
        stdout,
      );
      return;
    }

    case "seed-matrix": {
      const seed = await generateMatrixSeed(cwd);
      if (parsed.write) {
        await writeMatrixSeed(cwd, seed);
      }
      render(
        {
          matrixSeedPath: absorptionMatrixSeedPath(cwd),
          written: parsed.write,
          ...seed,
        },
        parsed.json,
        stdout,
      );
      return;
    }

    case "package": {
      const lane = parsed.positional[0];
      assertPackageLane(lane);
      const absorptionPackage = await buildAbsorptionPackage(cwd, lane);
      if (parsed.write) {
        await writeAbsorptionPackage(cwd, lane, absorptionPackage);
      }
      render(
        {
          packagePath: absorptionPackagePath(cwd, lane),
          written: parsed.write,
          ...absorptionPackage,
        },
        parsed.json,
        stdout,
      );
      return;
    }

    case "import": {
      const packageFile = parsed.positional[0];
      if (!packageFile) {
        throw new Error("Usage: omx absorb import <package-path> [--json]");
      }
      const importedPackage = JSON.parse(await readFile(packageFile, "utf-8")) as AbsorptionPackage;
      let registry = await readAbsorptionRegistry(cwd);
      if (importedPackage.registry) {
        for (const cocoon of importedPackage.registry.cocoons) {
          registry = registerCocoon(registry, cocoon);
        }
        await writeAbsorptionRegistry(cwd, registry);
      }
      if (importedPackage.matrixSeed) {
        await writeMatrixSeed(cwd, importedPackage.matrixSeed);
      }

      let activeForm = null;
      let projectMemory = null;
      if (importedPackage.activeForm) {
        activeForm = await writeActiveAbsorptionForm(cwd, importedPackage.activeForm);
        projectMemory = await syncActiveFormProjectMemory(cwd, activeForm);
      }
      const mergedProjectMemory = await mergeImportedProjectMemory(cwd, importedPackage.projectMemory);

      render(
        {
          importedLane: importedPackage.lane,
          registryPath: absorptionRegistryPath(cwd),
          matrixSeedPath: absorptionMatrixSeedPath(cwd),
          activeFormPath: activeAbsorptionFormPath(cwd),
          importedCocoons: importedPackage.registry?.cocoons.map((cocoon) => cocoon.id) ?? [],
          activeForm,
          wakeDirectives: deriveWakeDirectives(activeForm),
          projectMemory: mergedProjectMemory ?? projectMemory,
        },
        parsed.json,
        stdout,
      );
      return;
    }

    case "seed-apply": {
      const seed = await readMatrixSeed(cwd);
      if (!seed) {
        throw new Error("No matrix seed found. Run `omx absorb seed-matrix --write` first.");
      }
      let registry = await readAbsorptionRegistry(cwd);
      for (const suggestion of seed.suggestedCocoons) {
        registry = registerCocoon(
          registry,
          createCocoon({
            id: suggestion.id,
            name: suggestion.name,
            kind: suggestion.kind,
            source: suggestion.source,
            capabilities: suggestion.capabilities,
            notes: suggestion.notes,
          }),
        );
      }
      await writeAbsorptionRegistry(cwd, registry);
      render(
        {
          registryPath: absorptionRegistryPath(cwd),
          imported: seed.suggestedCocoons.map((cocoon) => cocoon.id),
          cocoons: registry.cocoons,
        },
        parsed.json,
        stdout,
      );
      return;
    }

    case "digest":
    case "reject": {
      const cocoonId = parsed.positional[0];
      if (!cocoonId) {
        throw new Error(`Usage: omx absorb ${parsed.subcommand} <id> [--note <text>] [--json]`);
      }
      const registry = await readAbsorptionRegistry(cwd);
      const cocoon = assertKnownCocoon(registry, cocoonId);
      const updated =
        parsed.subcommand === "digest"
          ? digestCocoon(cocoon, parsed.note)
          : rejectCocoon(cocoon, parsed.note);
      const nextRegistry = registerCocoon(registry, updated);
      await writeAbsorptionRegistry(cwd, nextRegistry);
      render(updated, parsed.json, stdout);
      return;
    }

    case "form": {
      const [formId, ...cocoonIds] = parsed.positional;
      if (!formId || cocoonIds.length === 0) {
        throw new Error("Usage: omx absorb form <id> <cocoon-id...> [--name <text>] [--json]");
      }
      const registry = await readAbsorptionRegistry(cwd);
      for (const cocoonId of cocoonIds) {
        assertKnownCocoon(registry, cocoonId);
      }
      render(
        activateForm(registry, formId, parsed.name ?? formId, cocoonIds),
        parsed.json,
        stdout,
      );
      return;
    }

    case "activate": {
      const [formId, ...cocoonIds] = parsed.positional;
      if (!formId || cocoonIds.length === 0) {
        throw new Error("Usage: omx absorb activate <id> <cocoon-id...> [--name <text>] [--json]");
      }
      const registry = await readAbsorptionRegistry(cwd);
      for (const cocoonId of cocoonIds) {
        assertKnownCocoon(registry, cocoonId);
      }
      const form = activateForm(registry, formId, parsed.name ?? formId, cocoonIds);
      const activeForm = await writeActiveAbsorptionForm(cwd, form);
      const projectMemory = await syncActiveFormProjectMemory(cwd, activeForm);
      render(
        {
          activeForm,
          wakeDirectives: deriveWakeDirectives(activeForm),
          projectMemory,
        },
        false,
        stdout,
      );
      return;
    }

    case "apply": {
      const profile = parsed.positional[0];
      if (!profile) {
        throw new Error("Usage: omx absorb apply <matrix-core|cell-gate|oracle-commander|full-power> [--json]");
      }
      const registry = await readAbsorptionRegistry(cwd);
      const profileSelection = resolveProfileCocoonIds(profile, registry);
      if (profileSelection.cocoonIds.length === 0) {
        throw new Error(`Profile ${profile} has no available cocoons in the current registry.`);
      }
      const form = activateForm(
        registry,
        profileSelection.formId,
        profileSelection.name,
        profileSelection.cocoonIds,
      );
      const activeForm = await writeActiveAbsorptionForm(cwd, form);
      const projectMemory = await syncActiveFormProjectMemory(cwd, activeForm);
      render(
        {
          profile,
          activeForm,
          wakeDirectives: deriveWakeDirectives(activeForm),
          projectMemory,
        },
        parsed.json,
        stdout,
      );
      return;
    }
  }
}
