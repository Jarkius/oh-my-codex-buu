import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildFollowupStaffingPlan,
  isApprovedExecutionFollowupShortcut,
  resolveAvailableAgentTypes,
} from '../followup-planner.js';

describe('followup-planner', () => {
  it('resolves available agent types from explicit prompt directories', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'omx-followup-roster-'));
    try {
      await writeFile(join(dir, 'executor.md'), '# Executor');
      await writeFile(join(dir, 'architect.md'), '# Architect');
      await writeFile(join(dir, 'test-engineer.md'), '# Test Engineer');

      const roles = await resolveAvailableAgentTypes(process.cwd(), { promptDirs: [dir] });
      assert.deepEqual(roles, ['architect', 'executor', 'test-engineer']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });


  it('includes team-executor when the prompt is available', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'omx-followup-roster-'));
    try {
      await writeFile(join(dir, 'executor.md'), '# Executor');
      await writeFile(join(dir, 'team-executor.md'), '# Team Executor');

      const roles = await resolveAvailableAgentTypes(process.cwd(), { promptDirs: [dir] });
      assert.deepEqual(roles, ['executor', 'team-executor']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('builds concrete team staffing guidance from the available roster', () => {
    const plan = buildFollowupStaffingPlan(
      'team',
      'Fix flaky integration tests and update README',
      ['executor', 'test-engineer', 'writer'],
      { workerCount: 3, fallbackRole: 'executor' },
    );

    assert.equal(plan.mode, 'team');
    assert.equal(plan.recommendedHeadcount, 3);
    assert.match(plan.staffingSummary, /test-engineer x1/);
    assert.match(plan.staffingSummary, /reasoning/);
    assert.ok(plan.allocations.every((allocation) => ['executor', 'test-engineer', 'writer'].includes(allocation.role)));
    assert.ok(
      plan.allocations.some((allocation) => allocation.reason.includes('specialist') || allocation.reason.includes('verification')),
    );
    assert.equal(plan.launchHints.shellCommand, 'omx team 3:executor "Fix flaky integration tests and update README"');
    assert.equal(plan.launchHints.skillCommand, '$team 3:executor "Fix flaky integration tests and update README"');
    assert.match(plan.verificationPlan.summary, /coordinated execution and verification owner/i);
    assert.equal(plan.verificationPlan.checkpoints.length, 3);
  });

  it('builds concrete ralph staffing guidance from the available roster', () => {
    const plan = buildFollowupStaffingPlan(
      'ralph',
      'Investigate auth regression and verify the fix',
      ['architect', 'debugger', 'executor', 'test-engineer'],
    );

    assert.equal(plan.mode, 'ralph');
    assert.equal(plan.recommendedHeadcount, 3);
    assert.match(plan.staffingSummary, /architect x1/);
    assert.match(plan.staffingSummary, /test-engineer x1/);
    assert.ok(plan.allocations.some((allocation) => allocation.reason.includes('sign-off')));
    assert.equal(plan.launchHints.shellCommand, 'omx ralph "Investigate auth regression and verify the fix"');
    assert.equal(plan.launchHints.skillCommand, '$ralph "Investigate auth regression and verify the fix"');
    assert.match(plan.verificationPlan.summary, /persistent execution and verification owner/i);
    assert.equal(plan.verificationPlan.checkpoints.length, 3);
  });

  it('upgrades team staffing when absorption wake directives demand quarantine and persistent workflow', () => {
    const plan = buildFollowupStaffingPlan(
      'team',
      'Absorb qwen commander behaviors into the active runtime safely',
      ['architect', 'executor', 'researcher', 'test-engineer'],
      {
        workerCount: 2,
        fallbackRole: 'executor',
        wakeDirectives: [
          'Quarantine and digest foreign workflows before adopting them into the active runtime.',
          'Persist workflow state and require visible stage transitions for large or risky work.',
          'Keep OMX as the operator-facing runtime surface; strengthen behavior through capabilities, not command renames.',
        ],
      },
    );

    assert.equal(plan.recommendedHeadcount, 3);
    assert.match(plan.staffingSummary, /quarantine \+ compatibility lane/);
    assert.match(plan.policySummary, /quarantine-aware absorption active/);
    assert.match(plan.policySummary, /persistent workflow policy active/);
    assert.match(plan.verificationPlan.summary, /Runtime-surface protection active/i);
    assert.ok(plan.verificationPlan.checkpoints.length >= 4);
  });

  it('recognizes short approved team follow-up shortcuts in English and Korean', () => {
    assert.equal(
      isApprovedExecutionFollowupShortcut('team', 'team', { planningComplete: true }),
      true,
    );
    assert.equal(
      isApprovedExecutionFollowupShortcut('team', 'team으로 해줘', { planningComplete: true }),
      true,
    );
  });

  it('rejects short follow-up shortcuts when the prior execution context conflicts', () => {
    assert.equal(
      isApprovedExecutionFollowupShortcut('team', 'team', {
        planningComplete: true,
        priorSkill: 'autopilot',
      }),
      false,
    );
  });
});
