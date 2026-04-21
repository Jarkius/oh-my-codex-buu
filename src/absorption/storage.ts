import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AbsorptionKind, AbsorptionRegistry, BuuCocoon, CocoonCapability } from "./registry.js";
import type { BuuForm } from "./forms.js";

const ABSORPTION_SCHEMA_VERSION = "1.0";

export interface GsdMatrix {
  goals: string[];
  systems: string[];
  differentiators: string[];
}

export interface MatrixSeedCocoon {
  id: string;
  name: string;
  kind: AbsorptionKind;
  source: string;
  notes?: string;
  capabilities: CocoonCapability[];
}

export interface MatrixSeed {
  schemaVersion: string;
  generatedAt: string;
  project: {
    name: string;
    description?: string;
    root: string;
  };
  gsd: GsdMatrix;
  suggestedCocoons: MatrixSeedCocoon[];
}

interface PersistedRegistry {
  schemaVersion: string;
  updatedAt: string;
  cocoons: BuuCocoon[];
}

export interface ActiveAbsorptionForm extends BuuForm {
  activatedAt: string;
}

export type AbsorptionPackageLane = "source" | "seed" | "reloaded";

export interface AbsorptionPackage {
  schemaVersion: string;
  lane: AbsorptionPackageLane;
  generatedAt: string;
  project: {
    name: string;
    description?: string;
    root: string;
  };
  sourceRefs: {
    registryPath: string;
    matrixSeedPath: string;
    activeFormPath: string;
    projectMemoryPath: string;
  };
  registrySummary: {
    cocoonCount: number;
    statusCounts: Record<string, number>;
  };
  registry?: AbsorptionRegistry;
  matrixSeed?: MatrixSeed | null;
  activeForm?: ActiveAbsorptionForm | null;
  wakeDirectives?: string[];
  projectMemory?: Pick<ProjectMemory, "techStack" | "conventions" | "build" | "notes" | "directives">;
}

interface ProjectMemoryDirective {
  directive: string;
  priority: string;
  context?: string;
  timestamp: string;
}

interface ProjectMemoryNote {
  category: string;
  content: string;
  timestamp: string;
}

interface ProjectMemory {
  techStack?: string;
  build?: string;
  conventions?: string;
  structure?: string;
  notes?: ProjectMemoryNote[];
  directives?: ProjectMemoryDirective[];
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim() !== ""))];
}

function resolveLocalQwenRoot(): string | null {
  const candidates = [
    process.env.OMX_ABSORPTION_QWEN_ROOT,
    join(homedir(), "workspace", "lab", "oh-my-qwen"),
    join(homedir(), "ghq", "github.com", "Jarkius", "oh-my-qwen"),
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function absorptionDir(cwd: string): string {
  return join(cwd, ".omx", "absorption");
}

function projectMemoryPath(cwd: string): string {
  return join(cwd, ".omx", "project-memory.json");
}

export function absorptionRegistryPath(cwd: string): string {
  return join(absorptionDir(cwd), "registry.json");
}

export function absorptionMatrixSeedPath(cwd: string): string {
  return join(absorptionDir(cwd), "matrix-seed.json");
}

export function activeAbsorptionFormPath(cwd: string): string {
  return join(absorptionDir(cwd), "active-form.json");
}

export function absorptionPackagePath(
  cwd: string,
  lane: AbsorptionPackageLane,
): string {
  return join(absorptionDir(cwd), "packages", `${lane}.json`);
}

export async function ensureAbsorptionDir(cwd: string): Promise<string> {
  const dir = absorptionDir(cwd);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function ensureAbsorptionPackageDir(cwd: string): Promise<string> {
  const dir = join(absorptionDir(cwd), "packages");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function readAbsorptionRegistry(cwd: string): Promise<AbsorptionRegistry> {
  const path = absorptionRegistryPath(cwd);
  if (!existsSync(path)) {
    return { cocoons: [] };
  }

  const parsed = JSON.parse(await readFile(path, "utf-8")) as Partial<PersistedRegistry>;
  return {
    cocoons: Array.isArray(parsed.cocoons) ? parsed.cocoons : [],
  };
}

export async function writeAbsorptionRegistry(
  cwd: string,
  registry: AbsorptionRegistry,
): Promise<PersistedRegistry> {
  await ensureAbsorptionDir(cwd);
  const persisted: PersistedRegistry = {
    schemaVersion: ABSORPTION_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    cocoons: registry.cocoons,
  };
  await writeFile(
    absorptionRegistryPath(cwd),
    `${JSON.stringify(persisted, null, 2)}\n`,
    "utf-8",
  );
  return persisted;
}

export async function writeMatrixSeed(cwd: string, seed: MatrixSeed): Promise<MatrixSeed> {
  await ensureAbsorptionDir(cwd);
  await writeFile(absorptionMatrixSeedPath(cwd), `${JSON.stringify(seed, null, 2)}\n`, "utf-8");
  return seed;
}

export async function readMatrixSeed(cwd: string): Promise<MatrixSeed | null> {
  const path = absorptionMatrixSeedPath(cwd);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf-8")) as MatrixSeed;
}

export async function writeActiveAbsorptionForm(
  cwd: string,
  form: BuuForm,
): Promise<ActiveAbsorptionForm> {
  await ensureAbsorptionDir(cwd);
  const activeForm: ActiveAbsorptionForm = {
    ...form,
    activatedAt: new Date().toISOString(),
  };
  await writeFile(activeAbsorptionFormPath(cwd), `${JSON.stringify(activeForm, null, 2)}\n`, "utf-8");
  return activeForm;
}

export async function readActiveAbsorptionForm(cwd: string): Promise<ActiveAbsorptionForm | null> {
  const path = activeAbsorptionFormPath(cwd);
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf-8")) as ActiveAbsorptionForm;
}

async function readProjectMemory(cwd: string): Promise<ProjectMemory> {
  const path = projectMemoryPath(cwd);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf-8")) as ProjectMemory;
  } catch {
    return {};
  }
}

export function deriveWakeDirectives(activeForm: ActiveAbsorptionForm | null): string[] {
  if (!activeForm) return [];

  const directives: string[] = [];
  const capabilityIds = new Set(
    activeForm.activeCapabilities.map((capability) => capability.id),
  );

  if (capabilityIds.has("workflow-orchestration")) {
    directives.push(
      "Prefer explicit clarify -> plan -> execute -> verify flow instead of jumping straight to implementation.",
    );
  }
  if (capabilityIds.has("operator-surface")) {
    directives.push(
      "Keep OMX as the operator-facing runtime surface; strengthen behavior through capabilities, not command renames.",
    );
  }
  if (capabilityIds.has("cocoon-registry")) {
    directives.push(
      "Record absorbed capabilities with provenance and status before treating them as native.",
    );
  }
  if (capabilityIds.has("form-activation")) {
    directives.push(
      "Compose focused fused forms from selected cocoons instead of blending every capability at once.",
    );
  }
  if (capabilityIds.has("external-target-bridges")) {
    directives.push(
      "Use adapter seams and envelopes to observe external systems before deeper integration.",
    );
  }
  if (capabilityIds.has("quarantine-gate")) {
    directives.push(
      "Quarantine and digest foreign workflows before adopting them into the active runtime.",
    );
  }
  if (capabilityIds.has("oracle-memory-loop")) {
    directives.push(
      "Use ψ memory, learnings, and retrospectives as the external brain for continuity and improvement.",
    );
  }
  if (capabilityIds.has("controlled-workflow-pipeline")) {
    directives.push(
      "Persist workflow state and require visible stage transitions for large or risky work.",
    );
  }

  return directives;
}

export async function syncActiveFormProjectMemory(
  cwd: string,
  activeForm: ActiveAbsorptionForm,
): Promise<ProjectMemory> {
  await ensureAbsorptionDir(cwd);
  const path = projectMemoryPath(cwd);
  let memory: ProjectMemory = {};
  if (existsSync(path)) {
    try {
      memory = JSON.parse(await readFile(path, "utf-8")) as ProjectMemory;
    } catch {
      memory = {};
    }
  }

  const directiveContextPrefix = "absorption-form:";
  const directives = deriveWakeDirectives(activeForm).map((directive) => ({
    directive,
    priority: "high",
    context: `${directiveContextPrefix}${activeForm.id}`,
    timestamp: new Date().toISOString(),
  }));

  memory.directives = (memory.directives ?? []).filter(
    (entry) => !String(entry.context ?? "").startsWith(directiveContextPrefix),
  );
  memory.directives.push(...directives);

  const activationNote: ProjectMemoryNote = {
    category: "architecture",
    content: `Active absorption form: ${activeForm.name} [${activeForm.cocoonIds.join(", ")}]`,
    timestamp: new Date().toISOString(),
  };
  memory.notes = (memory.notes ?? []).filter(
    (entry) => !entry.content.startsWith("Active absorption form: "),
  );
  memory.notes.unshift(activationNote);

  await writeFile(path, `${JSON.stringify(memory, null, 2)}\n`, "utf-8");
  return memory;
}

function summarizeRegistry(registry: AbsorptionRegistry): AbsorptionPackage["registrySummary"] {
  const statusCounts: Record<string, number> = {};
  for (const cocoon of registry.cocoons) {
    statusCounts[cocoon.status] = (statusCounts[cocoon.status] ?? 0) + 1;
  }
  return {
    cocoonCount: registry.cocoons.length,
    statusCounts,
  };
}

export async function buildAbsorptionPackage(
  cwd: string,
  lane: AbsorptionPackageLane,
): Promise<AbsorptionPackage> {
  const [registry, seed, activeForm, projectMemory] = await Promise.all([
    readAbsorptionRegistry(cwd),
    readMatrixSeed(cwd),
    readActiveAbsorptionForm(cwd),
    readProjectMemory(cwd),
  ]);

  const packageBase: AbsorptionPackage = {
    schemaVersion: ABSORPTION_SCHEMA_VERSION,
    lane,
    generatedAt: new Date().toISOString(),
    project: {
      name: seed?.project.name ?? "unknown-project",
      description: seed?.project.description,
      root: cwd,
    },
    sourceRefs: {
      registryPath: absorptionRegistryPath(cwd),
      matrixSeedPath: absorptionMatrixSeedPath(cwd),
      activeFormPath: activeAbsorptionFormPath(cwd),
      projectMemoryPath: projectMemoryPath(cwd),
    },
    registrySummary: summarizeRegistry(registry),
  };

  if (lane === "source") {
    return {
      ...packageBase,
      registry,
      activeForm,
    };
  }

  if (lane === "seed") {
    return {
      ...packageBase,
      matrixSeed: seed,
    };
  }

  return {
    ...packageBase,
    registry,
    matrixSeed: seed,
    activeForm,
    wakeDirectives: deriveWakeDirectives(activeForm),
    projectMemory: {
      techStack: projectMemory.techStack,
      conventions: projectMemory.conventions,
      build: projectMemory.build,
      notes: (projectMemory.notes ?? []).slice(0, 5),
      directives: (projectMemory.directives ?? []).slice(0, 10),
    },
  };
}

export async function writeAbsorptionPackage(
  cwd: string,
  lane: AbsorptionPackageLane,
  absorptionPackage: AbsorptionPackage,
): Promise<AbsorptionPackage> {
  await ensureAbsorptionPackageDir(cwd);
  await writeFile(
    absorptionPackagePath(cwd, lane),
    `${JSON.stringify(absorptionPackage, null, 2)}\n`,
    "utf-8",
  );
  return absorptionPackage;
}

export async function generateMatrixSeed(cwd: string): Promise<MatrixSeed> {
  const packageJsonPath = join(cwd, "package.json");
  const readmePath = join(cwd, "README.md");
  const packageJson = existsSync(packageJsonPath)
    ? (JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
        name?: string;
        description?: string;
      })
    : {};
  const readme = existsSync(readmePath) ? await readFile(readmePath, "utf-8") : "";
  const readmeSnippet = readme.split(/\r?\n/).slice(0, 80).join("\n");

  const goals: string[] = [];
  const systems: string[] = [];
  const differentiators: string[] = [];

  if (packageJson.description) goals.push(packageJson.description);
  if (/absorb/i.test(readmeSnippet)) {
    goals.push("Absorb external workflows without erasing provenance or compatibility context.");
  }
  if (/Codex-native orchestration/i.test(readmeSnippet)) {
    goals.push("Keep OMX distributable as a Codex-native orchestration runtime.");
  }

  const systemChecks: Array<[string, string]> = [
    ["src/cli", "CLI runtime and operator surface"],
    ["src/hooks", "Hook and lifecycle runtime"],
    ["src/team", "Parallel team execution runtime"],
    ["src/wiki", "Local wiki and knowledge surfaces"],
    ["src/adapt", "Adapter foundations for external systems"],
    ["src/absorption", "Absorption registry, cocoon, and form layer"],
  ];

  for (const [relativePath, label] of systemChecks) {
    if (existsSync(join(cwd, relativePath))) systems.push(label);
  }

  if (existsSync(join(cwd, "docs/philosophy/buu.md"))) {
    differentiators.push("Buu absorption philosophy layered on top of the OMX body");
  }
  if (existsSync(join(cwd, "src/absorption"))) {
    differentiators.push("Cocoon-based capability absorption with explicit provenance");
  }
  if (existsSync(join(cwd, "src/adapt"))) {
    differentiators.push("Foundation seams for external adapter targets");
  }
  if (existsSync(join(cwd, "src/wiki"))) {
    differentiators.push("Built-in local knowledge and wiki surfaces");
  }
  const qwenRoot = resolveLocalQwenRoot();
  if (qwenRoot) {
    differentiators.push("Can learn quarantine, Oracle memory, and workflow-pipeline patterns from local oh-my-qwen.");
  }

  const suggestedCocoons: MatrixSeedCocoon[] = [];

  if (existsSync(join(cwd, "src/cli")) || existsSync(join(cwd, "src/hooks"))) {
    suggestedCocoons.push({
      id: "omx-core",
      name: "OMX Core Runtime",
      kind: "repo",
      source: "local:src/cli+src/hooks+src/team",
      notes: "Primary execution body that should remain operator-facing.",
      capabilities: [
        {
          id: "workflow-orchestration",
          name: "Workflow orchestration",
          description: "Deep interview, planning, team runtime, and persistent execution flows.",
          tags: ["omx", "runtime", "workflow"],
        },
        {
          id: "operator-surface",
          name: "Operator surface",
          description: "CLI, hooks, HUD, and stateful runtime controls.",
          tags: ["cli", "hooks", "hud"],
        },
      ],
    });
  }

  if (existsSync(join(cwd, "src/absorption")) || existsSync(join(cwd, "docs/philosophy/buu.md"))) {
    suggestedCocoons.push({
      id: "buu-absorption",
      name: "Buu Absorption Layer",
      kind: "workflow",
      source: "local:src/absorption+docs/philosophy/buu.md",
      notes: "Capability expansion layer for provenance-aware absorption and fused forms.",
      capabilities: [
        {
          id: "cocoon-registry",
          name: "Cocoon registry",
          description: "Typed registry for absorbed capabilities and their provenance.",
          tags: ["absorption", "registry", "provenance"],
        },
        {
          id: "form-activation",
          name: "Form activation",
          description: "Compose selected cocoons into activatable fused forms.",
          tags: ["forms", "fusion", "activation"],
        },
      ],
    });
  }

  if (existsSync(join(cwd, "src/adapt"))) {
    suggestedCocoons.push({
      id: "adapter-foundations",
      name: "Adapter Foundations",
      kind: "workflow",
      source: "local:src/adapt",
      notes: "External target seams that can later be absorbed into richer forms.",
      capabilities: [
        {
          id: "external-target-bridges",
          name: "External target bridges",
          description: "Probe, status, envelope, and doctor surfaces for external systems.",
          tags: ["adapt", "bridge", "integration"],
        },
      ],
    });
  }

  if (qwenRoot) {
    suggestedCocoons.push({
      id: "qwen-cell-gate",
      name: "Qwen Cell Gate",
      kind: "workflow",
      source: `local:${qwenRoot}`,
      notes: "Imported pattern candidate from oh-my-qwen: quarantine before absorbing, Oracle memory, and controlled workflow state.",
      capabilities: [
        {
          id: "quarantine-gate",
          name: "Quarantine gate",
          description: "Digest external capabilities before blending them into the active runtime.",
          tags: ["qwen", "cell-gate", "quarantine"],
        },
        {
          id: "oracle-memory-loop",
          name: "Oracle memory loop",
          description: "Use ψ memory and retrospectives as the external brain for continuous improvement.",
          tags: ["oracle", "psi", "memory"],
        },
        {
          id: "controlled-workflow-pipeline",
          name: "Controlled workflow pipeline",
          description: "Interview, plan, execute, and verify as explicit stages with persisted state.",
          tags: ["workflow", "pipeline", "state"],
        },
      ],
    });
  }

  return {
    schemaVersion: ABSORPTION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    project: {
      name: packageJson.name ?? "unknown-project",
      description: packageJson.description,
      root: cwd,
    },
    gsd: {
      goals: unique(goals.length > 0 ? goals : ["Strengthen OMX without breaking the operator-facing runtime surface."]),
      systems: unique(systems),
      differentiators: unique(differentiators),
    },
    suggestedCocoons,
  };
}
