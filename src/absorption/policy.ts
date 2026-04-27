import type { ActiveAbsorptionForm } from "./storage.js";

export interface AbsorptionPolicySignals {
  quarantine: boolean;
  persistentWorkflow: boolean;
  protectRuntimeSurface: boolean;
  externalObservation: boolean;
  memoryLoop: boolean;
}

export interface AbsorptionPlanningPolicy {
  signals: AbsorptionPolicySignals;
  summary: string;
  requirements: string[];
  verificationBias: string[];
  recommendedExecutionMode: "ralph" | "team";
}

function capabilityIdSet(activeForm: ActiveAbsorptionForm | null): Set<string> {
  return new Set(
    (activeForm?.activeCapabilities ?? []).map((capability) => capability.id),
  );
}

export function deriveAbsorptionPolicySignals(
  activeForm: ActiveAbsorptionForm | null,
): AbsorptionPolicySignals {
  const ids = capabilityIdSet(activeForm);
  return {
    quarantine:
      ids.has("quarantine-gate")
      || ids.has("cocoon-registry"),
    persistentWorkflow:
      ids.has("workflow-orchestration")
      || ids.has("controlled-workflow-pipeline"),
    protectRuntimeSurface:
      ids.has("operator-surface"),
    externalObservation:
      ids.has("external-target-bridges"),
    memoryLoop:
      ids.has("oracle-memory-loop"),
  };
}

export function derivePlanningPolicy(
  activeForm: ActiveAbsorptionForm | null,
): AbsorptionPlanningPolicy {
  const signals = deriveAbsorptionPolicySignals(activeForm);
  const requirements: string[] = [];
  const verificationBias: string[] = [];

  if (signals.quarantine) {
    requirements.push(
      "Require provenance and compatibility review before treating absorbed behavior as native.",
    );
    verificationBias.push(
      "Include a quarantine/compatibility check in verification, not just build/test success.",
    );
  }

  if (signals.persistentWorkflow) {
    requirements.push(
      "Prefer explicit clarify -> plan -> execute -> verify stage transitions for large or risky work.",
    );
    requirements.push(
      "Bias toward PRD + test-spec artifacts before implementation when scope is broad or risk is elevated.",
    );
    verificationBias.push(
      "Keep verification evidence aligned with the current workflow stage instead of treating testing as an end-only step.",
    );
  }

  if (signals.protectRuntimeSurface) {
    requirements.push(
      "Preserve the OMX operator-facing runtime surface unless there is an explicit compatibility break decision.",
    );
    verificationBias.push(
      "Prioritize CLI/runtime compatibility checks when evaluating changes.",
    );
  }

  if (signals.externalObservation) {
    requirements.push(
      "Observe external systems through adapter/envelope seams before deeper integration or control assumptions.",
    );
  }

  if (signals.memoryLoop) {
    requirements.push(
      "Promote stable learnings into durable memory instead of leaving them only in transient runtime state.",
    );
  }

  const summary = [
    signals.quarantine ? "quarantine-aware" : "",
    signals.persistentWorkflow ? "stage-gated" : "",
    signals.protectRuntimeSurface ? "runtime-surface-protective" : "",
    signals.externalObservation ? "observe-before-integrate" : "",
    signals.memoryLoop ? "memory-promoting" : "",
  ].filter(Boolean).join("; ") || "default planning policy";

  return {
    signals,
    summary,
    requirements,
    verificationBias,
    recommendedExecutionMode:
      signals.quarantine || signals.persistentWorkflow ? "team" : "ralph",
  };
}
