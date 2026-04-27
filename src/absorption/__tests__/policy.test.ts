import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivePlanningPolicy } from "../policy.js";
import type { ActiveAbsorptionForm } from "../storage.js";

function buildActiveForm(capabilityIds: string[]): ActiveAbsorptionForm {
  return {
    id: "test-form",
    name: "Test Form",
    cocoonIds: ["one"],
    activeCapabilities: capabilityIds.map((id) => ({
      id,
      name: id,
      description: id,
      tags: [id],
    })),
    activatedAt: new Date().toISOString(),
  };
}

describe("absorption policy", () => {
  it("derives default planning policy when no active form exists", () => {
    const policy = derivePlanningPolicy(null);
    assert.equal(policy.summary, "default planning policy");
    assert.equal(policy.requirements.length, 0);
    assert.equal(policy.recommendedExecutionMode, "ralph");
  });

  it("derives quarantine and stage-gated planning policy from active capabilities", () => {
    const policy = derivePlanningPolicy(
      buildActiveForm([
        "quarantine-gate",
        "controlled-workflow-pipeline",
        "operator-surface",
        "oracle-memory-loop",
      ]),
    );

    assert.equal(policy.signals.quarantine, true);
    assert.equal(policy.signals.persistentWorkflow, true);
    assert.equal(policy.signals.protectRuntimeSurface, true);
    assert.equal(policy.signals.memoryLoop, true);
    assert.equal(policy.recommendedExecutionMode, "team");
    assert.ok(policy.requirements.some((requirement) => /PRD \+ test-spec/i.test(requirement)));
    assert.ok(policy.requirements.some((requirement) => /Preserve the OMX operator-facing runtime surface/i.test(requirement)));
    assert.ok(policy.verificationBias.some((item) => /compatibility/i.test(item)));
  });
});
