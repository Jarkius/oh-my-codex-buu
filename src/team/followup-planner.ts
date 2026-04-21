import { join } from 'path';
import { codexPromptsDir, packageRoot } from '../utils/paths.js';
import { resolveAgentReasoningEffort, type TeamReasoningEffort } from './model-contract.js';
import { listAvailableRoles, routeTaskToRole } from './role-router.js';

export type FollowupMode = 'team' | 'ralph';

export interface FollowupAllocation {
  role: string;
  count: number;
  reason: string;
  reasoningEffort?: TeamReasoningEffort;
}

export interface FollowupLaunchHints {
  shellCommand: string;
  skillCommand: string;
  rationale: string;
}

export interface FollowupVerificationPlan {
  summary: string;
  checkpoints: string[];
}

export interface FollowupStaffingPlan {
  mode: FollowupMode;
  availableAgentTypes: string[];
  recommendedHeadcount: number;
  allocations: FollowupAllocation[];
  policySummary: string;
  rosterSummary: string;
  staffingSummary: string;
  launchHints: FollowupLaunchHints;
  verificationPlan: FollowupVerificationPlan;
}

export interface ResolveAvailableAgentTypesOptions {
  promptDirs?: string[];
}

export interface BuildFollowupStaffingPlanOptions {
  workerCount?: number;
  fallbackRole?: string;
  wakeDirectives?: string[];
}

export interface ApprovedExecutionFollowupContext {
  planningComplete?: boolean;
  priorSkill?: string | null;
}

const SHORT_TEAM_FOLLOWUP_PATTERNS: RegExp[] = [
  /^team$/i,
  /^team\s+please$/i,
  /^team(?:으로)?\s+해줘$/i,
  /^team(?:으로)?\s+해주세요$/i,
];

const SHORT_RALPH_FOLLOWUP_PATTERNS: RegExp[] = [
  /^ralph$/i,
  /^ralph\s+please$/i,
];

function normalizeFollowupShortcutText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function isShortTeamFollowupRequest(text: string): boolean {
  const normalized = normalizeFollowupShortcutText(text);
  return SHORT_TEAM_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isShortRalphFollowupRequest(text: string): boolean {
  const normalized = normalizeFollowupShortcutText(text);
  return SHORT_RALPH_FOLLOWUP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isApprovedExecutionFollowupShortcut(
  mode: FollowupMode,
  text: string,
  context: ApprovedExecutionFollowupContext = {},
): boolean {
  if (context.planningComplete !== true) return false;
  if (context.priorSkill && context.priorSkill.toLowerCase() !== 'ralplan') return false;
  return mode === 'team'
    ? isShortTeamFollowupRequest(text)
    : isShortRalphFollowupRequest(text);
}

function defaultPromptDirs(projectRoot: string): string[] {
  return [
    join(projectRoot, 'prompts'),
    join(projectRoot, '.codex', 'prompts'),
    join(packageRoot(), 'prompts'),
    codexPromptsDir(),
  ];
}

export async function resolveAvailableAgentTypes(
  projectRoot: string,
  options: ResolveAvailableAgentTypesOptions = {},
): Promise<string[]> {
  const dirs = options.promptDirs ?? defaultPromptDirs(projectRoot);
  const roles = new Set<string>();

  for (const dir of dirs) {
    const dirRoles = await listAvailableRoles(dir);
    for (const role of dirRoles) roles.add(role);
  }

  return [...roles].sort();
}

function chooseAvailableRole(
  availableRoles: readonly string[],
  preferredRoles: readonly string[],
  fallbackRole: string,
): string {
  for (const role of preferredRoles) {
    if (availableRoles.includes(role)) return role;
  }
  if (availableRoles.includes(fallbackRole)) return fallbackRole;
  return availableRoles[0] ?? fallbackRole;
}

function mergeAllocation(
  allocations: FollowupAllocation[],
  role: string,
  count: number,
  reason: string,
): void {
  if (count <= 0) return;
  const reasoningEffort = resolveAgentReasoningEffort(role);
  const existing = allocations.find(
    (item) => item.role === role && item.reason === reason && item.reasoningEffort === reasoningEffort,
  );
  if (existing) {
    existing.count += count;
    return;
  }
  allocations.push({ role, count, reason, reasoningEffort });
}

function summarizeAllocations(allocations: readonly FollowupAllocation[]): string {
  return allocations
    .map((allocation) => {
      const reasoning = allocation.reasoningEffort ? `, ${allocation.reasoningEffort} reasoning` : '';
      return `${allocation.role} x${allocation.count} (${allocation.reason}${reasoning})`;
    })
    .join('; ');
}

function toQuotedCliArg(value: string): string {
  return JSON.stringify(value);
}

function buildLaunchHints(
  mode: FollowupMode,
  task: string,
  recommendedHeadcount: number,
  fallbackRole: string,
): FollowupLaunchHints {
  if (mode === 'team') {
    return {
      shellCommand: `omx team ${recommendedHeadcount}:${fallbackRole} ${toQuotedCliArg(task)}`,
      skillCommand: `$team ${recommendedHeadcount}:${fallbackRole} ${toQuotedCliArg(task)}`,
      rationale: 'Launch team directly when coordinated parallel delivery plus built-in verification lanes are sufficient without a separate linked Ralph launch.',
    };
  }

  return {
    shellCommand: `omx ralph ${toQuotedCliArg(task)}`,
    skillCommand: `$ralph ${toQuotedCliArg(task)}`,
    rationale: 'Launch Ralph directly when one persistent implementation + verification loop is sufficient without team coordination overhead.',
  };
}

function buildVerificationPlan(
  mode: FollowupMode,
  allocations: readonly FollowupAllocation[],
  policySignals: {
    quarantine: boolean;
    persistentWorkflow: boolean;
    protectRuntimeSurface: boolean;
  },
): FollowupVerificationPlan {
  if (mode === 'team') {
    const qualityLane = allocations.find((allocation) => allocation.reason.includes('verification'));
    return {
      summary: [
        'Use team as the coordinated execution and verification owner: delivery lanes run in parallel while a dedicated verification lane captures fresh evidence before shutdown.',
        policySignals.quarantine
          ? 'Quarantine policy active: include compatibility review before absorbed behavior is treated as ready.'
          : '',
        policySignals.protectRuntimeSurface
          ? 'Runtime-surface protection active: preserve the OMX operator contract while parallel work proceeds.'
          : '',
      ].filter(Boolean).join(' '),
      checkpoints: [
        'Launch via `omx team ...` (or `$team ...`) so the team runtime owns both parallel delivery and coordinated verification.',
        `Keep ${qualityLane?.role ?? 'the verification lane'} focused on tests, regression coverage, and evidence capture before team shutdown.`,
        ...(policySignals.quarantine
          ? ['Require a quarantine/compatibility pass before absorbed capabilities are promoted to active production behavior.']
          : []),
        'Escalate to a separate Ralph run only when a later manual follow-up still needs a persistent single-owner verification/fix loop.',
      ],
    };
  }

  return {
    summary: [
      'Use Ralph as the persistent execution and verification owner: implementation happens first, then evidence/regression checks, then final sign-off.',
      policySignals.persistentWorkflow
        ? 'Persistent workflow policy active: keep execution and verification stage transitions explicit.'
        : '',
      policySignals.protectRuntimeSurface
        ? 'Runtime-surface protection active: prefer preserving OMX contracts over opportunistic side changes.'
        : '',
    ].filter(Boolean).join(' '),
    checkpoints: [
      'Run fresh verification commands before claiming completion.',
      'Keep the evidence/regression lane current with test/build output.',
      ...(policySignals.quarantine
        ? ['Re-check provenance and compatibility before adopting absorbed behavior as complete.']
        : []),
      'Finish with the final sign-off lane reviewing completion evidence against acceptance criteria.',
    ],
  };
}

function pickSpecialistRole(
  task: string,
  availableRoles: readonly string[],
  fallbackRole: string,
): string {
  const normalizedTask = task.toLowerCase();

  if (/(security|auth|authorization|authentication|xss|injection|cve|vulnerability)/.test(normalizedTask)) {
    return chooseAvailableRole(availableRoles, ['security-reviewer', 'architect'], fallbackRole);
  }
  if (/(debug|regression|root cause|stack trace|incident|flaky)/.test(normalizedTask)) {
    return chooseAvailableRole(availableRoles, ['debugger', 'architect'], fallbackRole);
  }
  if (/(build|compile|tsc|type error|lint)/.test(normalizedTask)) {
    return chooseAvailableRole(availableRoles, ['build-fixer', 'debugger'], fallbackRole);
  }
  if (/(ui|ux|layout|css|responsive|design|frontend)/.test(normalizedTask)) {
    return chooseAvailableRole(availableRoles, ['designer'], fallbackRole);
  }
  if (/(readme|docs|documentation|changelog|migration)/.test(normalizedTask)) {
    return chooseAvailableRole(availableRoles, ['writer'], fallbackRole);
  }

  return chooseAvailableRole(availableRoles, ['architect', 'researcher'], fallbackRole);
}

export function buildFollowupStaffingPlan(
  mode: FollowupMode,
  task: string,
  availableAgentTypes: readonly string[],
  options: BuildFollowupStaffingPlanOptions = {},
): FollowupStaffingPlan {
  const fallbackRole = options.fallbackRole ?? 'executor';
  const rawWorkerCount = Math.max(1, options.workerCount ?? (mode === 'team' ? 2 : 3));
  const wakeDirectives = options.wakeDirectives ?? [];
  const normalizedWakeText = wakeDirectives.join(' ').toLowerCase();
  const policySignals = {
    quarantine:
      /quarantine|digest foreign workflows|provenance/.test(normalizedWakeText),
    persistentWorkflow:
      /persist workflow state|explicit clarify -> plan -> execute -> verify|stage transitions/.test(normalizedWakeText),
    protectRuntimeSurface:
      /operator-facing runtime surface|omx as the operator-facing/.test(normalizedWakeText),
  };
  const workerCount =
    mode === 'team' && (policySignals.quarantine || policySignals.persistentWorkflow)
      ? Math.max(rawWorkerCount, 3)
      : rawWorkerCount;
  const primaryRoute = routeTaskToRole(
    task,
    task,
    mode === 'team' ? 'team-exec' : 'team-verify',
    fallbackRole,
  );
  const primaryRole = chooseAvailableRole(availableAgentTypes, [primaryRoute.role], fallbackRole);
  const qualityRole = chooseAvailableRole(
    availableAgentTypes,
    ['test-engineer', 'verifier', 'quality-reviewer'],
    primaryRole,
  );
  const allocations: FollowupAllocation[] = [];

  mergeAllocation(allocations, primaryRole, 1, mode === 'team' ? 'primary delivery lane' : 'primary implementation lane');

  if (mode === 'team') {
    if (workerCount >= 2) {
      mergeAllocation(allocations, qualityRole, 1, 'verification + regression lane');
    }
    if (workerCount >= 3) {
      const specialistRole = policySignals.quarantine
        ? chooseAvailableRole(availableAgentTypes, ['architect', 'researcher', 'debugger'], primaryRole)
        : pickSpecialistRole(task, availableAgentTypes, primaryRole);
      mergeAllocation(
        allocations,
        specialistRole,
        1,
        policySignals.quarantine ? 'quarantine + compatibility lane' : 'specialist support lane',
      );
    }
    if (workerCount >= 4) {
      mergeAllocation(allocations, primaryRole, workerCount - 3, 'extra implementation capacity');
    }
  } else {
    mergeAllocation(allocations, qualityRole, 1, 'evidence + regression checks');
    const architectRole = chooseAvailableRole(
      availableAgentTypes,
      ['architect', 'critic', 'verifier'],
      qualityRole,
    );
    mergeAllocation(allocations, architectRole, 1, 'final architecture / completion sign-off');

    if (workerCount >= 4) {
      const specialistRole = pickSpecialistRole(task, availableAgentTypes, primaryRole);
      mergeAllocation(allocations, specialistRole, workerCount - 3, 'parallel specialist follow-up capacity');
    }
  }

  const policySummary = [
    policySignals.quarantine ? 'quarantine-aware absorption active' : '',
    policySignals.persistentWorkflow ? 'persistent workflow policy active' : '',
    policySignals.protectRuntimeSurface ? 'runtime-surface protection active' : '',
  ].filter(Boolean).join('; ') || 'default execution policy';

  return {
    mode,
    availableAgentTypes: [...availableAgentTypes],
    recommendedHeadcount: workerCount,
    allocations,
    policySummary,
    rosterSummary: availableAgentTypes.join(', '),
    staffingSummary: summarizeAllocations(allocations),
    launchHints: buildLaunchHints(mode, task, workerCount, fallbackRole),
    verificationPlan: buildVerificationPlan(mode, allocations, policySignals),
  };
}
